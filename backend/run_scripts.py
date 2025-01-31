import threading
import subprocess

def run_script(script_name):
    subprocess.run(['python', script_name])

if __name__ == '__main__':
    scripts = ['main.py', 'Predictor.py']
    threads = []

    for script in scripts:
        thread = threading.Thread(target=run_script, args=(script,))
        threads.append(thread)
        thread.start()

    for thread in threads:
        thread.join()