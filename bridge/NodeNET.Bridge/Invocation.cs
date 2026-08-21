using System.Reflection;
using System.Runtime.Loader;
using System.Text.Json;

namespace NodeNET.Bridge;

internal static class Invocation
{
    private sealed class LibraryLoadContext : AssemblyLoadContext
    {
        private readonly AssemblyDependencyResolver? _resolver;
        private readonly string _directory;

        public LibraryLoadContext(string assemblyPath)
            : base($"NodeNET:{Path.GetFileNameWithoutExtension(assemblyPath)}", isCollectible: false)
        {
            _directory = Path.GetDirectoryName(assemblyPath) ?? Directory.GetCurrentDirectory();
            try { _resolver = new AssemblyDependencyResolver(assemblyPath); } catch { }
        }

        protected override Assembly? Load(AssemblyName assemblyName)
        {
            var resolved = _resolver?.ResolveAssemblyToPath(assemblyName);
            if (resolved is not null) return LoadFromAssemblyPath(resolved);
            var sibling = Path.Combine(_directory, $"{assemblyName.Name}.dll");
            return File.Exists(sibling) ? LoadFromAssemblyPath(sibling) : null;
        }

        protected override IntPtr LoadUnmanagedDll(string unmanagedDllName)
        {
            var resolved = _resolver?.ResolveUnmanagedDllToPath(unmanagedDllName);
            return resolved is not null ? LoadUnmanagedDllFromPath(resolved) : IntPtr.Zero;
        }
    }

    private sealed record LoadedAssembly(LibraryLoadContext Context, Assembly Assembly);
    private sealed record BoundMethod(MethodBase Method, object?[] Values, int Score);

    private static readonly Dictionary<string, LoadedAssembly> Assemblies = new(StringComparer.OrdinalIgnoreCase);
    private static readonly object AssemblyLock = new();
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web) { PropertyNameCaseInsensitive = true };

    public static async Task<BridgeResult> DispatchAsync(RpcRequest request, ObjectTable objects)
    {
        return request.Operation switch
        {
            "invoke" => await InvokeLegacyAsync(request, objects).ConfigureAwait(false),
            "describe" => Describe(request, objects),
            "construct" => await ConstructAsync(request, objects).ConfigureAwait(false),
            "call" => await CallAsync(request, objects).ConfigureAwait(false),
            "get" => Get(request, objects),
            "set" => Set(request, objects),
            "dispose" => BridgeResult.FromValue(new { disposed = await objects.DisposeAsync(Required(request.Handle, "handle")).ConfigureAwait(false) }),
            "stream.read" => await ReadStreamAsync(request, objects).ConfigureAwait(false),
            "stream.write" => await WriteStreamAsync(request, objects).ConfigureAwait(false),
            _ => throw new InvalidOperationException($"Unsupported RPC operation: {request.Operation}")
        };
    }

    private static BridgeResult Describe(RpcRequest request, ObjectTable objects)
    {
        var type = request.Handle is not null ? objects.Get(request.Handle).GetType() : ResolveType(request);
        var descriptor = new
        {
            name = type.FullName,
            assembly = type.Assembly.GetName().Name,
            constructors = type.GetConstructors(BindingFlags.Public | BindingFlags.Instance)
                .Select(DescribeMethod).ToArray(),
            methods = type.GetMethods(BindingFlags.Public | BindingFlags.Static | BindingFlags.Instance)
                .Where(method => !method.IsSpecialName).Select(DescribeMethod).ToArray(),
            properties = type.GetProperties(BindingFlags.Public | BindingFlags.Static | BindingFlags.Instance)
                .Select(property => new { name = property.Name, type = TypeName(property.PropertyType), canRead = property.CanRead, canWrite = property.CanWrite }).ToArray(),
            events = type.GetEvents(BindingFlags.Public | BindingFlags.Static | BindingFlags.Instance)
                .Select(@event => new { name = @event.Name, type = TypeName(@event.EventHandlerType) }).ToArray()
        };
        return BridgeResult.FromValue(descriptor);
    }

    private static object DescribeMethod(MethodBase method) => new
    {
        name = method is ConstructorInfo ? ".ctor" : method.Name,
        signature = FormatSignature(method),
        isStatic = method.IsStatic,
        parameters = method.GetParameters().Select(parameter => new { name = parameter.Name, type = TypeName(parameter.ParameterType), optional = parameter.IsOptional }).ToArray(),
        returns = method is MethodInfo info ? TypeName(info.ReturnType) : TypeName(method.DeclaringType)
    };

    private static async Task<BridgeResult> ConstructAsync(RpcRequest request, ObjectTable objects)
    {
        var type = ResolveType(request);
        var constructors = type.GetConstructors(BindingFlags.Public | BindingFlags.Instance).Cast<MethodBase>().ToArray();
        var bound = BindBest(constructors, request, objects);
        var instance = ((ConstructorInfo)bound.Method).Invoke(bound.Values)
            ?? throw new InvalidOperationException($"Constructor for {type.FullName} returned null.");
        return Handle(instance, objects);
    }

    private static async Task<BridgeResult> CallAsync(RpcRequest request, ObjectTable objects)
    {
        object? instance = null;
        Type type;
        BindingFlags flags;
        if (request.Handle is not null)
        {
            instance = objects.Get(request.Handle);
            type = instance.GetType();
            flags = BindingFlags.Public | BindingFlags.Instance;
        }
        else
        {
            type = ResolveType(request);
            flags = BindingFlags.Public | BindingFlags.Static;
        }
        var member = Required(request.Member, "member");
        var candidates = type.GetMethods(flags).Where(method => method.Name == member).Cast<MethodBase>().ToArray();
        var bound = BindBest(candidates, request, objects);
        try
        {
            var result = ((MethodInfo)bound.Method).Invoke(instance, bound.Values);
            return Normalize(await UnwrapAsync(result).ConfigureAwait(false), objects);
        }
        catch (TargetInvocationException error) when (error.InnerException is not null) { throw error.InnerException; }
    }

    private static BridgeResult Get(RpcRequest request, ObjectTable objects)
    {
        object? instance = null;
        Type type;
        BindingFlags flags;
        if (request.Handle is not null) { instance = objects.Get(request.Handle); type = instance.GetType(); flags = BindingFlags.Public | BindingFlags.Instance; }
        else { type = ResolveType(request); flags = BindingFlags.Public | BindingFlags.Static; }
        var member = Required(request.Member, "member");
        var property = type.GetProperty(member, flags) ?? throw new MissingMemberException(type.FullName, member);
        if (!property.CanRead) throw new InvalidOperationException($"Property {type.FullName}.{member} is not readable.");
        return Normalize(property.GetValue(instance), objects);
    }

    private static BridgeResult Set(RpcRequest request, ObjectTable objects)
    {
        object? instance = null;
        Type type;
        BindingFlags flags;
        if (request.Handle is not null) { instance = objects.Get(request.Handle); type = instance.GetType(); flags = BindingFlags.Public | BindingFlags.Instance; }
        else { type = ResolveType(request); flags = BindingFlags.Public | BindingFlags.Static; }
        var member = Required(request.Member, "member");
        var property = type.GetProperty(member, flags) ?? throw new MissingMemberException(type.FullName, member);
        if (!property.CanWrite) throw new InvalidOperationException($"Property {type.FullName}.{member} is not writable.");
        var value = ConvertArgument(request.Value, property.PropertyType, request.Payload, objects);
        property.SetValue(instance, value);
        return BridgeResult.FromValue(true);
    }

    private static async Task<BridgeResult> InvokeLegacyAsync(RpcRequest request, ObjectTable objects)
    {
        var type = ResolveType(request);
        var member = Required(request.Member, "member");
        var candidates = type.GetMethods(BindingFlags.Public | BindingFlags.Static | BindingFlags.Instance)
            .Where(method => method.Name == member).Cast<MethodBase>().ToArray();
        var bound = BindBest(candidates, request, objects);
        object? instance = null;
        if (!bound.Method.IsStatic)
        {
            instance = Activator.CreateInstance(type)
                ?? throw new InvalidOperationException($"Unable to construct {type.FullName}. A public parameterless constructor is required for legacy invoke().");
        }
        try
        {
            var value = ((MethodInfo)bound.Method).Invoke(instance, bound.Values);
            return Normalize(await UnwrapAsync(value).ConfigureAwait(false), objects);
        }
        catch (TargetInvocationException error) when (error.InnerException is not null) { throw error.InnerException; }
    }

    private static async Task<BridgeResult> ReadStreamAsync(RpcRequest request, ObjectTable objects)
    {
        var stream = objects.Get(Required(request.Handle, "handle")) as Stream
            ?? throw new InvalidOperationException("The requested handle is not a System.IO.Stream.");
        var count = Math.Clamp(request.Count <= 0 ? 65536 : request.Count, 1, 16 * 1024 * 1024);
        var buffer = new byte[count];
        var read = await stream.ReadAsync(buffer.AsMemory(0, count)).ConfigureAwait(false);
        var payload = read == buffer.Length ? buffer : buffer[..read];
        return new BridgeResult(new Dictionary<string, object?> { ["$binary"] = true, ["length"] = read, ["eof"] = read == 0 }, payload);
    }

    private static async Task<BridgeResult> WriteStreamAsync(RpcRequest request, ObjectTable objects)
    {
        var stream = objects.Get(Required(request.Handle, "handle")) as Stream
            ?? throw new InvalidOperationException("The requested handle is not a System.IO.Stream.");
        await stream.WriteAsync(request.Payload.AsMemory()).ConfigureAwait(false);
        await stream.FlushAsync().ConfigureAwait(false);
        return BridgeResult.FromValue(new { written = request.Payload.Length });
    }

    private static BoundMethod BindBest(IEnumerable<MethodBase> methods, RpcRequest request, ObjectTable objects)
    {
        var candidates = methods
            .Where(method => method.GetParameters().Length == request.Arguments.Length)
            .Where(method => string.IsNullOrWhiteSpace(request.Signature) || FormatSignature(method) == request.Signature)
            .OrderBy(FormatSignature, StringComparer.Ordinal)
            .ToArray();
        if (candidates.Length == 0) throw new MissingMethodException($"No matching member accepts {request.Arguments.Length} argument(s).");

        var bound = new List<BoundMethod>();
        foreach (var method in candidates)
        {
            try
            {
                var parameters = method.GetParameters();
                var values = new object?[parameters.Length];
                var score = 0;
                for (var i = 0; i < parameters.Length; i++)
                {
                    values[i] = ConvertArgument(request.Arguments[i], parameters[i].ParameterType, request.Payload, objects);
                    score += ScoreArgument(request.Arguments[i], parameters[i].ParameterType);
                }
                bound.Add(new BoundMethod(method, values, score));
            }
            catch { }
        }
        if (bound.Count == 0) throw new ArgumentException("No overload accepted the supplied arguments.");
        return bound.OrderByDescending(item => item.Score).ThenBy(item => FormatSignature(item.Method), StringComparer.Ordinal).First();
    }

    private static int ScoreArgument(JsonElement value, Type type)
    {
        var target = Nullable.GetUnderlyingType(type) ?? type;
        return value.ValueKind switch
        {
            JsonValueKind.String when target == typeof(string) => 10,
            JsonValueKind.True or JsonValueKind.False when target == typeof(bool) => 10,
            JsonValueKind.Number when IsNumeric(target) => 8,
            JsonValueKind.Null when !target.IsValueType || Nullable.GetUnderlyingType(type) is not null => 6,
            JsonValueKind.Object when value.TryGetProperty("$handle", out _) => 10,
            JsonValueKind.Object when value.TryGetProperty("$binary", out _) && (target == typeof(byte[]) || target == typeof(Memory<byte>) || target == typeof(ReadOnlyMemory<byte>)) => 10,
            _ => 1
        };
    }

    private static object? ConvertArgument(JsonElement value, Type targetType, byte[] payload, ObjectTable objects)
    {
        if (value.ValueKind == JsonValueKind.Object && value.TryGetProperty("$handle", out var handleElement))
        {
            var target = objects.Get(handleElement.GetString() ?? string.Empty);
            if (!targetType.IsInstanceOfType(target)) throw new InvalidCastException($"Handle object {target.GetType().FullName} cannot be assigned to {targetType.FullName}.");
            return target;
        }
        if (value.ValueKind == JsonValueKind.Object && value.TryGetProperty("$stream", out var streamElement))
        {
            var target = objects.Get(streamElement.GetString() ?? string.Empty);
            if (!targetType.IsInstanceOfType(target)) throw new InvalidCastException($"Stream handle {target.GetType().FullName} cannot be assigned to {targetType.FullName}.");
            return target;
        }
        if (value.ValueKind == JsonValueKind.Object && value.TryGetProperty("$binary", out var binary))
        {
            var offset = binary.TryGetProperty("offset", out var offsetElement) ? offsetElement.GetInt32() : 0;
            var length = binary.TryGetProperty("length", out var lengthElement) ? lengthElement.GetInt32() : payload.Length - offset;
            if (offset < 0 || length < 0 || offset + length > payload.Length) throw new ArgumentOutOfRangeException(nameof(value), "Binary argument range is invalid.");
            var bytes = payload.AsMemory(offset, length).ToArray();
            if (targetType == typeof(byte[])) return bytes;
            if (targetType == typeof(Memory<byte>)) return new Memory<byte>(bytes);
            if (targetType == typeof(ReadOnlyMemory<byte>)) return new ReadOnlyMemory<byte>(bytes);
        }
        if (targetType == typeof(JsonElement)) return value;
        return value.Deserialize(targetType, JsonOptions);
    }

    private static BridgeResult Normalize(object? value, ObjectTable objects)
    {
        if (value is null) return BridgeResult.FromValue(null);
        if (value is byte[] bytes) return new BridgeResult(new Dictionary<string, object?> { ["$binary"] = true, ["length"] = bytes.Length }, bytes);
        if (value is Stream stream)
        {
            var streamHandle = objects.Add(stream, "stream");
            return BridgeResult.FromValue(new Dictionary<string, object?> { ["$stream"] = streamHandle, ["$type"] = value.GetType().FullName });
        }
        var type = value.GetType();
        if (IsPassByValue(type)) return BridgeResult.FromValue(value);
        return Handle(value, objects);
    }

    private static BridgeResult Handle(object value, ObjectTable objects)
    {
        var handle = objects.Add(value);
        return BridgeResult.FromValue(new Dictionary<string, object?> { ["$handle"] = handle, ["$type"] = value.GetType().FullName });
    }

    private static bool IsPassByValue(Type type)
    {
        var target = Nullable.GetUnderlyingType(type) ?? type;
        if (target.IsPrimitive || target.IsEnum || target.IsValueType) return true;
        if (target == typeof(string) || target == typeof(decimal) || target == typeof(Guid) || target == typeof(DateTime) || target == typeof(DateTimeOffset)) return true;
        if (target.IsArray) return IsPassByValue(target.GetElementType() ?? typeof(object));
        return false;
    }

    private static bool IsNumeric(Type type) => type == typeof(byte) || type == typeof(sbyte) || type == typeof(short) || type == typeof(ushort)
        || type == typeof(int) || type == typeof(uint) || type == typeof(long) || type == typeof(ulong) || type == typeof(float)
        || type == typeof(double) || type == typeof(decimal);

    private static Type ResolveType(RpcRequest request)
    {
        var assemblyPath = Path.GetFullPath(Required(request.Assembly, "assembly"));
        if (!File.Exists(assemblyPath)) throw new FileNotFoundException("Assembly does not exist.", assemblyPath);
        var assembly = LoadAssembly(assemblyPath);
        return assembly.GetType(Required(request.Type, "type"), throwOnError: true, ignoreCase: false)
            ?? throw new TypeLoadException($"Unable to resolve type {request.Type}.");
    }

    private static Assembly LoadAssembly(string assemblyPath)
    {
        lock (AssemblyLock)
        {
            if (Assemblies.TryGetValue(assemblyPath, out var loaded)) return loaded.Assembly;
            var context = new LibraryLoadContext(assemblyPath);
            var assembly = context.LoadFromAssemblyPath(assemblyPath);
            Assemblies[assemblyPath] = new LoadedAssembly(context, assembly);
            return assembly;
        }
    }

    private static async Task<object?> UnwrapAsync(object? value)
    {
        if (value is null) return null;
        if (value is Task task)
        {
            await task.ConfigureAwait(false);
            var taskType = task.GetType();
            return taskType.IsGenericType ? taskType.GetProperty("Result")?.GetValue(task) : null;
        }
        var type = value.GetType();
        if (type.FullName?.StartsWith("System.Threading.Tasks.ValueTask", StringComparison.Ordinal) == true)
        {
            var asTask = type.GetMethod("AsTask", BindingFlags.Public | BindingFlags.Instance);
            if (asTask?.Invoke(value, null) is Task valueTask)
            {
                await valueTask.ConfigureAwait(false);
                var valueTaskType = valueTask.GetType();
                return valueTaskType.IsGenericType ? valueTaskType.GetProperty("Result")?.GetValue(valueTask) : null;
            }
        }
        return value;
    }

    private static string FormatSignature(MethodBase method) => $"{(method is ConstructorInfo ? ".ctor" : method.Name)}({string.Join(",", method.GetParameters().Select(parameter => TypeName(parameter.ParameterType)))})";
    private static string TypeName(Type? type) => type?.FullName ?? type?.Name ?? "System.Object";
    private static string Required(string? value, string name) => string.IsNullOrWhiteSpace(value) ? throw new ArgumentException($"{name} is required") : value;
}
