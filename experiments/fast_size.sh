#!/bin/bash

download_params=(
    "10000"    #10kb
    "1000000"  #1mb
    "30000000" #30mb
)

timeout_params=(
    "1000"
    "10000"
    "30000"
)

num_flows=(
    "1" "3" "5"
)

script_path=~/rabbits-perf/fast/fast.js
script_output_path=~/output

rm -rf ${script_output_path}/*

for timeout in "${timeout_params[@]}"; do
    for param in "${download_params[@]}"; do
        for flow in "${num_flows[@]}"; do
            # server=$((RANDOM % 5 + 1))
            file_name="fast_size/fast_download_${param}_${timeout}_${flow}"
            echo "node ${script_path} -download -size ${param} -timeout ${timeout} -flows ${flow}"
            node ${script_path} -download -size ${param} -timeout ${timeout} -flows ${flow}
            mkdir -p results/${file_name}
            rm -rf results/${file_name}/*
            cp -R ${script_output_path} results/${file_name}/
            rm -rf ${script_output_path}/*
        done
    done
done

for timeout in "${timeout_params[@]}"; do
    for param in "${download_params[@]}"; do
        for flow in "${num_flows[@]}"; do
            # server=$((RANDOM % 5 + 1))
            file_name="fast_size/fast_upload_${param}_${timeout}_${flow}"
            echo "node ${script_path} -upload -size ${param} -timeout ${timeout} -flows ${flow}"
            node ${script_path} -upload -size ${param} -timeout ${timeout} -flows ${flow}
            mkdir -p results/${file_name}
            rm -rf results/${file_name}/*
            cp -R ${script_output_path} results/${file_name}/
            rm -rf ${script_output_path}/*
        done
    done
done
