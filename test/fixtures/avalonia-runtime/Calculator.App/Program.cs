using Avalonia;

namespace NodeNET.RuntimeFixture;

internal static class Program
{
    [STAThread]
    public static void Main(string[] args) => BuildAvaloniaApp().StartWithClassicDesktopLifetime(args);

    public static AppBuilder BuildAvaloniaApp() => AppBuilder.Configure<DesktopApp>()
        .UsePlatformDetect()
        .WithInterFont()
        .LogToTrace();
}
