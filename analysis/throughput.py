import json
import argparse
# Function to read a file and parse JSON
def parse_json_from_file(file_path):
    with open(file_path, 'r') as file:
        return json.load(file)

# Function to calculate duration in milliseconds
def calculate_duration(progress):
    start_time = int(progress[0]['time'])
    end_time = int(progress[-1]['time'])
    return end_time - start_time

# Function to calculate throughput for each ID
def calculate_throughput(data):
    throughput_map = {}

    # Loop through each upload data
    for upload in data:
        id = upload['id']
        progress = upload['progress']

        # Calculate duration for this progress
        duration = calculate_duration(progress)

        # Sum byte counts for this progress
        total_byte_count = sum(progress_obj['bytecount'] for progress_obj in progress)

        # Calculate throughput in bytes per millisecond
        throughput = total_byte_count / duration

        # Convert throughput to bytes per second
        throughput_bytes_per_second = throughput * 1000

        # Store throughput for this ID
        throughput_map[id] = throughput_bytes_per_second

    return throughput_map

parser = argparse.ArgumentParser(
    prog="throughput.py",
    description="Throughput calculation"
    )
parser.add_argument("serverName")
args=parser.parse_args()
# Load data from file
data = parse_json_from_file("analysis/output/" +args.serverName+"/byte_time_list.json")

# Load data from file
data = parse_json_from_file("analysis/output/" +args.serverName+"/byte_time_list.json")

# Calculate throughput by IDs
throughput_by_ids = calculate_throughput(data)

# Print throughput by IDs
print("Throughput by IDs:", throughput_by_ids)

