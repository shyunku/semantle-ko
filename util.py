import threading

def list_threads():
    for thread in threading.enumerate():
        # write to file
        log = f"{thread.name} (ID: {thread.ident})\n"
        with open("threads.log", "a") as f:
            f.write(log)