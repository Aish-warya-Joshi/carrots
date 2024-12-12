import os

def create_directories():
    tests = ["test1", "test2"]
    types = ["download", "upload"]
    modes = ["single", "multi"]
    threads = {"single": [1], "multi": [3, 5]}
    sizes = [10000, 1000000, 30000000]

    for test in tests:
        for type_ in types:
            for mode in modes:
                for thread in threads[mode]:
                    for size in sizes:
                        dir_name = f"{test}_ookla_{type_}_{mode}_{thread}_{size}"
                        os.makedirs(dir_name, exist_ok=True)
                        print(f"Created: {dir_name}")

if __name__ == "__main__":
    create_directories()