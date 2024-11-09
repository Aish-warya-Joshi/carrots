import json
from collections import defaultdict
from typing import Dict, Any

def max_bytecounts_at_same_time(file_path: str) -> Dict[str, Any]:
    # Load data from the JSON file
    with open(file_path, 'r') as file:
        data = json.load(file)
   
    # Dictionary to store the count of bytecounts per timestamp
    time_bytecount_map = defaultdict(int)

    # Process each entry in the data
    for entry in data:
        for progress in entry["progress"]:
            timestamp = progress["time"]
            time_bytecount_map[timestamp] += 1

    # Find the maximum count and the corresponding timestamp(s)
    max_count = max(time_bytecount_map.values())
    max_timestamps = [time for time, count in time_bytecount_map.items() if count == max_count]

    return {
        "max_count": max_count,
        "timestamps": max_timestamps
    }

# Example usage
file_path = 'data.json'  # Replace with the path to your JSON file
result = max_bytecounts_at_same_time('analysis/output/ookla/byte_time_list.json')
print(result)