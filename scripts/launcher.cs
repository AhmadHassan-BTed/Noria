using System;
using System.Diagnostics;
using System.IO;

class Launcher {
    static void Main() {
        Console.Title = "Noria — Agentic Control Center";
        Console.WriteLine("===================================================");
        Console.WriteLine("              STARTING NORIA LOCALHOST             ");
        Console.WriteLine("===================================================");
        Console.WriteLine();

        // 1. Verify Node.js is installed
        if (!IsCommandAvailable("node")) {
            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine("[ERROR] Node.js is not installed!");
            Console.ResetColor();
            Console.WriteLine("Please download and install Node.js from: https://nodejs.org/");
            Console.WriteLine("After installing Node.js, please restart this launcher.");
            Console.WriteLine("\nPress Enter to exit...");
            Console.ReadLine();
            return;
        }

        // 2. Check and run run_noria.bat
        string batPath = "run_noria.bat";
        if (File.Exists(batPath)) {
            Console.WriteLine("[1/2] Invoking local system setup and launchers...");
            try {
                ProcessStartInfo startInfo = new ProcessStartInfo();
                startInfo.FileName = "cmd.exe";
                startInfo.Arguments = "/c " + batPath;
                startInfo.UseShellExecute = false; // Run in the same console window
                Process process = Process.Start(startInfo);
                process.WaitForExit();
            }
            catch (Exception e) {
                Console.WriteLine("\n[WARNING] Launcher script error: " + e.Message);
                Console.ReadLine();
            }
        }
        else {
            Console.WriteLine("[ERROR] run_noria.bat was not found in the current folder!");
            Console.WriteLine("\nPress Enter to exit...");
            Console.ReadLine();
        }
    }

    static bool IsCommandAvailable(string command) {
        try {
            ProcessStartInfo startInfo = new ProcessStartInfo();
            startInfo.FileName = "where";
            startInfo.Arguments = command;
            startInfo.RedirectStandardOutput = true;
            startInfo.RedirectStandardError = true;
            startInfo.UseShellExecute = false;
            startInfo.CreateNoWindow = true;
            using (Process process = Process.Start(startInfo)) {
                process.WaitForExit();
                return process.ExitCode == 0;
            }
        }
        catch {
            return false;
        }
    }
}
