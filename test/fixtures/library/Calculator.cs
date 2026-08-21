namespace NodeNET.TestLibrary;

public static class Calculator
{
    public static int Add(int a, int b) => a + b;
    public static async Task<string> EchoAsync(string value)
    {
        await Task.Yield();
        return value;
    }
}

public sealed class Counter : IDisposable
{
    public Counter(int initial) => Value = initial;

    public int Value { get; set; }

    public void Increment() => Value++;

    public byte[] EchoBytes(byte[] value) => value;

    public Stream OpenStream(byte[] value) => new MemoryStream(value, writable: false);

    public void Dispose() { }
}
