using System;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Threading;

class Launcher {
    static void Main() {
        Console.Title = "Noria — Agentic Control Center";
        Console.ForegroundColor = ConsoleColor.Cyan;
        Console.WriteLine("===================================================");
        Console.WriteLine("              STARTING NORIA LOCALHOST             ");
        Console.WriteLine("       Agentic Control Center  v1.0.0              ");
        Console.WriteLine("===================================================");
        Console.ResetColor();
        Console.WriteLine();

        // Resolve root from exe location (works from any working directory)
        string exeDir = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location);
        // The exe lives in dist/, so root is one level up
        string rootDir = Path.GetFullPath(Path.Combine(exeDir, ".."));

        // If app.py is not in parent, try the exe dir itself (for portable builds)
        if (!File.Exists(Path.Combine(rootDir, "app.py"))) {
            rootDir = exeDir;
        }

        Console.WriteLine("[INFO] Noria Root: " + rootDir);
        Console.WriteLine();

        // 1. Check Python
        Console.WriteLine("[1/4] Checking Python...");
        if (!IsCommandAvailable("python")) {
            PrintError("Python is not installed or not in PATH!");
            Console.WriteLine("Download Python from: https://www.python.org/downloads/");
            Console.WriteLine("Make sure to check 'Add Python to PATH' during installation.");
            Console.ReadLine();
            return;
        }
        Console.ForegroundColor = ConsoleColor.Green;
        Console.WriteLine("      Python found.");
        Console.ResetColor();
        Console.WriteLine();

        // 2. Install/update Python dependencies
        string requirementsPath = Path.Combine(rootDir, "requirements.txt");
        if (File.Exists(requirementsPath)) {
            Console.WriteLine("[2/4] Installing Python dependencies (this may take a moment)...");
            RunCommand("python", "-m pip install -r \"" + requirementsPath + "\" --quiet", rootDir);
        } else {
            Console.WriteLine("[2/4] No requirements.txt found, skipping pip install.");
        }
        Console.WriteLine();

        // 3. Check Node.js & install npm deps
        Console.WriteLine("[3/4] Checking Node.js...");
        if (!IsCommandAvailable("node")) {
            Console.ForegroundColor = ConsoleColor.Yellow;
            Console.WriteLine("      [WARN] Node.js not found. The Noria scanning engine requires Node.js.");
            Console.ResetColor();
            Console.WriteLine("      Download from: https://nodejs.org/");
        } else {
            Console.ForegroundColor = ConsoleColor.Green;
            Console.WriteLine("      Node.js found.");
            Console.ResetColor();
            string packageJsonPath = Path.Combine(rootDir, "package.json");
            if (File.Exists(packageJsonPath)) {
                Console.WriteLine("      Installing Node.js dependencies...");
                RunCommand("npm", "install --no-audit --no-fund", rootDir);
            }
        }
        Console.WriteLine();

        // 4. Launch Streamlit and open browser as app window
        Console.WriteLine("[4/4] Launching Noria Control Center...");
        Console.ForegroundColor = ConsoleColor.Cyan;
        Console.WriteLine("      Opening as standalone app window...");
        Console.ResetColor();
        Console.WriteLine();

        string appPy = Path.Combine(rootDir, "app.py");
        if (!File.Exists(appPy)) {
            PrintError("app.py was not found at: " + appPy);
            Console.WriteLine("\nPlease ensure the Noria files are intact.");
            Console.ReadLine();
            return;
        }

        // Launch Streamlit in background (headless)
        ProcessStartInfo streamlitInfo = new ProcessStartInfo();
        streamlitInfo.FileName = "python";
        streamlitInfo.Arguments = "-m streamlit run \"" + appPy + "\" --server.headless true --server.port 8501 --browser.gatherUsageStats false";
        streamlitInfo.WorkingDirectory = rootDir;
        streamlitInfo.UseShellExecute = false;
        streamlitInfo.CreateNoWindow = false;

        Process streamlitProcess = Process.Start(streamlitInfo);

        // Wait for streamlit to boot
        Console.WriteLine("      Waiting for server to start...");
        Thread.Sleep(3000);

        // Open in Chrome or Edge as --app window (not a tab)
        bool launched = TryOpenAppWindow("chrome", "http://localhost:8501");
        if (!launched) launched = TryOpenAppWindow("msedge", "http://localhost:8501");
        if (!launched) {
            // Fallback: open default browser normally
            Process.Start(new ProcessStartInfo("http://localhost:8501") { UseShellExecute = true });
        }

        Console.ForegroundColor = ConsoleColor.Green;
        Console.WriteLine();
        Console.WriteLine("===================================================");
        Console.WriteLine("   Noria is running at http://localhost:8501");
        Console.WriteLine("   Close this window to stop the server.");
        Console.WriteLine("===================================================");
        Console.ResetColor();
        Console.WriteLine();

        // Keep this console alive — when it closes, streamlit ends too
        if (streamlitProcess != null) {
            streamlitProcess.WaitForExit();
        }
    }

    static bool TryOpenAppWindow(string browser, string url) {
        try {
            ProcessStartInfo info = new ProcessStartInfo();
            info.FileName = browser;
            info.Arguments = "--app=" + url + " --window-size=1280,800";
            info.UseShellExecute = true;
            Process.Start(info);
            return true;
        } catch {
            return false;
        }
    }

    static void RunCommand(string executable, string args, string workDir) {
        try {
            ProcessStartInfo info = new ProcessStartInfo();
            info.FileName = executable;
            info.Arguments = args;
            info.WorkingDirectory = workDir;
            info.UseShellExecute = false;
            info.CreateNoWindow = false;
            using (Process p = Process.Start(info)) {
                p.WaitForExit();
            }
        } catch (Exception ex) {
            Console.ForegroundColor = ConsoleColor.Yellow;
            Console.WriteLine("      [WARN] " + ex.Message);
            Console.ResetColor();
        }
    }

    static void PrintError(string msg) {
        Console.ForegroundColor = ConsoleColor.Red;
        Console.WriteLine("[ERROR] " + msg);
        Console.ResetColor();
        Console.WriteLine("\nPress Enter to exit...");
    }

    static bool IsCommandAvailable(string command) {
        try {
            ProcessStartInfo info = new ProcessStartInfo();
            info.FileName = "where";
            info.Arguments = command;
            info.RedirectStandardOutput = true;
            info.RedirectStandardError = true;
            info.UseShellExecute = false;
            info.CreateNoWindow = true;
            using (Process p = Process.Start(info)) {
                p.WaitForExit();
                return p.ExitCode == 0;
            }
        } catch {
            return false;
        }
    }
}
