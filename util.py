import threading
from datetime import datetime, timezone
from pytz import utc, timezone

def list_threads():
    for thread in threading.enumerate():
        # write to file
        log = f"{thread.name} (ID: {thread.ident})\n"
        with open("threads.log", "a") as f:
            f.write(log)

def now():
    return datetime.now(utc).timestamp()