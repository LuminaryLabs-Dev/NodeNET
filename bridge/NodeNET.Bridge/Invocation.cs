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
            try
            {
                _resolver = new AssemblyDependencyResolver(assemblyPath);
            }
            catch
            {
                // Libraries without a deps.json still get sibling-DLL resolution below.
            }
        }

        protected override Assembly? Load(AssemblyName assemblyName)
        {
            var resolved = _resolver?.ResolveAssemblyToPath(assemblyName);
            if (resolved is not null)
                return LoadFromAssemblyPath(resolved);

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

    private static readonly Dictionary<string, LoadedAssembly> Assemblies = new(StringComparer.OrdinalIgnoreCase);
    private static readonly object AssemblyLock = new();
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        PropertyNameCaseInsensitive = true
    };

    public static async Task<object?> InvokeAsync(RpcRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Assembly))
            throw new ArgumentException("assembly is required");
        if (string.IsNullOrWhiteSpace(request.Type))
            throw new ArgumentException("type is required");
        if (string.IsNullOrWhiteSpace(request.Member))
            throw new ArgumentException("member is required");

        var assemblyPath = Path.GetFullPath(request.Assembly);
        if (!File.Exists(assemblyPath))
            throw new FileNotFoundException("Assembly does not exist.", assemblyPath);

        var assembly = LoadAssembly(assemblyPath);
        var type = assembly.GetType(request.Type, throwOnError: true, ignoreCase: false)
            ?? throw new TypeLoadException($"Unable to resolve type {request.Type}.");

        var candidates = type
            .GetMethods(BindingFlags.Public | BindingFlags.Static | BindingFlags.Instance)
            .Where(method => method.Name == request.Member && method.GetParameters().Length == request.Arguments.Length)
            .ToArray();

        if (candidates.Length == 0)
            throw new MissingMethodException(type.FullName, request.Member);

        var conversionErrors = new List<Exception>();
        foreach (var method in candidates)
        {
            object?[]? values;
            try
            {
                values = BindArguments(method.GetParameters(), request.Arguments);
            }
            catch (Exception error)
            {
                conversionErrors.Add(error);
                continue;
            }

            object? instance = null;
            if (!method.IsStatic)
            {
                instance = Activator.CreateInstance(type)
                    ?? throw new InvalidOperationException($"Unable to construct {type.FullName}. A public parameterless constructor is required for instance invocation.");
            }

            try
            {
                var value = method.Invoke(instance, values);
                return await UnwrapAsync(value).ConfigureAwait(false);
            }
            catch (TargetInvocationException error) when (error.InnerException is not null)
            {
                throw error.InnerException;
            }
        }

        throw new ArgumentException(
            $"No overload of {type.FullName}.{request.Member} accepted the supplied JSON arguments.",
            conversionErrors.FirstOrDefault());
    }

    private static Assembly LoadAssembly(string assemblyPath)
    {
        lock (AssemblyLock)
        {
            if (Assemblies.TryGetValue(assemblyPath, out var loaded))
                return loaded.Assembly;

            var context = new LibraryLoadContext(assemblyPath);
            var assembly = context.LoadFromAssemblyPath(assemblyPath);
            Assemblies[assemblyPath] = new LoadedAssembly(context, assembly);
            return assembly;
        }
    }

    private static object?[] BindArguments(ParameterInfo[] parameters, JsonElement[] arguments)
    {
        var values = new object?[parameters.Length];
        for (var i = 0; i < parameters.Length; i++)
        {
            values[i] = arguments[i].Deserialize(parameters[i].ParameterType, JsonOptions);
        }
        return values;
    }

    private static async Task<object?> UnwrapAsync(object? value)
    {
        if (value is null) return null;

        if (value is Task task)
        {
            await task.ConfigureAwait(false);
            var taskType = task.GetType();
            if (taskType.IsGenericType)
                return taskType.GetProperty("Result")?.GetValue(task);
            return null;
        }

        var type = value.GetType();
        if (type.FullName?.StartsWith("System.Threading.Tasks.ValueTask", StringComparison.Ordinal) == true)
        {
            var asTask = type.GetMethod("AsTask", BindingFlags.Public | BindingFlags.Instance);
            if (asTask?.Invoke(value, null) is Task valueTask)
            {
                await valueTask.ConfigureAwait(false);
                var valueTaskType = valueTask.GetType();
                if (valueTaskType.IsGenericType)
                    return valueTaskType.GetProperty("Result")?.GetValue(valueTask);
            }
            return null;
        }

        return value;
    }
}
