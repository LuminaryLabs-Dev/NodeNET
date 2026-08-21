using System.Collections.Concurrent;

namespace NodeNET.Bridge;

internal sealed class ObjectTable
{
    private readonly ConcurrentDictionary<string, object> _objects = new();
    private long _sequence;

    public string Add(object value, string prefix = "obj")
    {
        var id = $"{prefix}:{Interlocked.Increment(ref _sequence)}";
        if (!_objects.TryAdd(id, value)) throw new InvalidOperationException("Unable to allocate a NodeNET object handle.");
        return id;
    }

    public object Get(string handle)
    {
        if (!_objects.TryGetValue(handle, out var value)) throw new KeyNotFoundException($"Unknown NodeNET handle: {handle}");
        return value;
    }

    public async Task<bool> DisposeAsync(string handle)
    {
        if (!_objects.TryRemove(handle, out var value)) return false;
        if (value is IAsyncDisposable asyncDisposable) await asyncDisposable.DisposeAsync().ConfigureAwait(false);
        else if (value is IDisposable disposable) disposable.Dispose();
        return true;
    }

    public async Task ClearAsync()
    {
        foreach (var handle in _objects.Keys.ToArray()) await DisposeAsync(handle).ConfigureAwait(false);
    }
}
