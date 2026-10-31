using System.Threading.Tasks;
using Avalonia;
using Avalonia.Browser;

namespace NodeNET.RuntimeFixture;

internal sealed class Program
{
    private static Task Main(string[] args) => AppBuilder.Configure<BrowserApp>()
        .WithInterFont()
        .StartBrowserAppAsync("out");
}
