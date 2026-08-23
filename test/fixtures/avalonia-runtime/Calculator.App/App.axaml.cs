using System.Text.Json;
using Avalonia;
using Avalonia.Controls.ApplicationLifetimes;
using Avalonia.Markup.Xaml;

namespace NodeNET.RuntimeFixture;

public partial class DesktopApp : Application
{
    public override void Initialize() => AvaloniaXamlLoader.Load(this);

    public override void OnFrameworkInitializationCompleted()
    {
        if (ApplicationLifetime is IClassicDesktopStyleApplicationLifetime desktop)
        {
            var window = new CalculatorWindow();
            desktop.MainWindow = window;
            window.Closed += (_, _) => WriteVisibleVerification(window);
        }

        base.OnFrameworkInitializationCompleted();
    }

    private static void WriteVisibleVerification(CalculatorWindow window)
    {
        var output = Environment.GetEnvironmentVariable("NODENET_VISIBLE_REPORT_PATH");
        if (string.IsNullOrWhiteSpace(output)) return;
        var verification = new
        {
            framework = "Avalonia",
            mode = "visible-desktop",
            processId = Environment.ProcessId,
            expected = "19",
            actual = window.DisplayText,
            inputCount = window.State.InputCount,
            pass = window.DisplayText == "19"
        };
        Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(output))!);
        File.WriteAllText(output, JsonSerializer.Serialize(verification, new JsonSerializerOptions { WriteIndented = true }) + Environment.NewLine);
    }
}
