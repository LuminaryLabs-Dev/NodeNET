import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { NodeNET } from '../../src/index.js';

const enabled = process.env.NODENET_AVALONIA === '1';
const sdk = process.env.NODENET_TEST_SDK ?? '10.0';

function pngInfo(buffer) {
  assert.deepEqual([...buffer.subarray(0, 8)], [137,80,78,71,13,10,26,10]);
  assert.equal(buffer.subarray(12, 16).toString('ascii'), 'IHDR');
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

test('NodeNET creates, builds, runs, interacts with, and renders a real Avalonia app headlessly', { skip: !enabled, timeout: 25 * 60_000 }, async () => {
  const work = await fs.mkdtemp(path.join(os.tmpdir(), 'nodenet-avalonia-'));
  const home = path.join(work, 'home');
  const output = path.resolve(process.env.NODENET_AVALONIA_OUTPUT ?? path.join(work, 'artifacts'));
  const net = await NodeNET.attach(work, { mode: 'shared', home, isolation: 'managed', sdk, writeState: false });
  try {
    const context = await net.prepare({ restore: false });
    assert.equal(context.dotnet.source, 'managed');
    await net.exec(['new', 'install', 'Avalonia.Templates'], { cwd: work });
    await net.exec(['new', 'avalonia.app', '-o', 'App'], { cwd: work });
    const appDir = path.join(work, 'App');
    const project = path.join(appDir, 'App.csproj');
    await net.exec(['add', project, 'package', 'Avalonia.Headless'], { cwd: appDir });

    await fs.writeFile(path.join(appDir, 'MainWindow.axaml'), `<Window xmlns="https://github.com/avaloniaui" xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml" x:Class="App.MainWindow" Width="800" Height="600" Title="NodeNET Avalonia"><StackPanel HorizontalAlignment="Center" VerticalAlignment="Center" Spacing="16"><TextBlock x:Name="CountText" Text="Count: 0" FontSize="32"/><Button x:Name="IncrementButton" Content="Increment" Click="Increment"/></StackPanel></Window>\n`);
    await fs.writeFile(path.join(appDir, 'MainWindow.axaml.cs'), `using Avalonia.Controls;\nusing Avalonia.Interactivity;\nnamespace App;\npublic partial class MainWindow : Window\n{\n    private int _count;\n    public MainWindow() => InitializeComponent();\n    private void Increment(object? sender, RoutedEventArgs e)\n    {\n        _count++;\n        var text = this.FindControl<TextBlock>("CountText") ?? throw new InvalidOperationException("CountText was not created.");\n        text.Text = $"Count: {_count}";\n    }\n}\n`);
    await fs.writeFile(path.join(appDir, 'Program.cs'), `using System.Text.Json;\nusing Avalonia;\nusing Avalonia.Controls;\nusing Avalonia.Headless;\nusing Avalonia.Interactivity;\nusing Avalonia.Threading;\nnamespace App;\ninternal static class Program\n{\n    [STAThread]\n    public static void Main(string[] args)\n    {\n        var output = Path.GetFullPath(args.Length > 0 ? args[0] : "artifacts");\n        Directory.CreateDirectory(output);\n        AppBuilder.Configure<App>().UseSkia().UseHeadless(new AvaloniaHeadlessPlatformOptions { UseHeadlessDrawing = false }).SetupWithoutStarting();\n        var window = new MainWindow();\n        window.Show();\n        Dispatcher.UIThread.RunJobs();\n        var count = window.FindControl<TextBlock>("CountText") ?? throw new InvalidOperationException("CountText missing.");\n        var button = window.FindControl<Button>("IncrementButton") ?? throw new InvalidOperationException("IncrementButton missing.");\n        var initial = count.Text;\n        var initialPath = Path.Combine(output, "initial.png");\n        window.CaptureRenderedFrame().Save(initialPath);\n        button.RaiseEvent(new RoutedEventArgs(Button.ClickEvent));\n        Dispatcher.UIThread.RunJobs();\n        var after = count.Text;\n        var updatedPath = Path.Combine(output, "incremented.png");\n        window.CaptureRenderedFrame().Save(updatedPath);\n        File.WriteAllText(Path.Combine(output, "state.json"), JsonSerializer.Serialize(new { created = true, started = true, headless = true, initial, afterInteraction = after, initialPng = File.Exists(initialPath), updatedPng = File.Exists(updatedPath) }));\n        window.Close();\n    }\n}\n`);

    const app = await NodeNET.attach(project, { mode: 'shared', home, isolation: 'managed', sdk, writeState: false });
    try {
      const prepared = await app.prepare();
      assert.equal(prepared.ready, true);
      const build = await app.build();
      assert.equal(build.ok, true);
      await fs.mkdir(output, { recursive: true });
      const handle = await app.run({ args: [output] });
      const run = await handle.wait();
      assert.equal(run.ok, true, run.stderr);
    } finally { await app.dispose(); }

    const state = JSON.parse(await fs.readFile(path.join(output, 'state.json'), 'utf8'));
    assert.equal(state.created, true);
    assert.equal(state.started, true);
    assert.equal(state.headless, true);
    assert.equal(state.initial, 'Count: 0');
    assert.equal(state.afterInteraction, 'Count: 1');
    assert.equal(state.initialPng, true);
    assert.equal(state.updatedPng, true);
    for (const name of ['initial.png', 'incremented.png']) {
      const bytes = await fs.readFile(path.join(output, name));
      assert.ok(bytes.length > 1000, `${name} should contain rendered pixels`);
      const info = pngInfo(bytes);
      assert.ok(info.width > 0 && info.height > 0);
    }
  } finally {
    await net.dispose();
    await fs.rm(work, { recursive: true, force: true });
  }
});
