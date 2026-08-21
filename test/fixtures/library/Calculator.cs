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
