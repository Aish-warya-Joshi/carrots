#!/bin/bash

mkdir -p results/speedofme
rm -rf results/speedofme/*

script_path=~/rabbits-perf/speedofme/speedofme.js
script_output_path=~/output

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

rm -rf ${script_output_path}/*

for timeout in "${timeout_params[@]}"; do
    for param in "${download_params[@]}"; do
        for flow in "${num_flows[@]}"; do
            file_name="speedofme/speedofme_download_${timeout}_${param}_${flow}"
            echo "node ${script_path} -download -timeout ${timeout} -size ${param} -flows ${flow}"
            node ${script_path} -download -timeout ${timeout} -size ${param} -flows ${flow}
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
            file_name="speedofme/speedofme_upload_${timeout}_${param}_${flow}"
            echo "node ${script_path} -upload -timeout ${timeout} -size ${param} -flows ${flow}"
            node ${script_path} -upload -timeout ${timeout} -size ${param} -flows ${flow}
            mkdir -p results/${file_name}
            rm -rf results/${file_name}/*
            cp -R ${script_output_path} results/${file_name}/
            rm -rf ${script_output_path}/*
        done
    done
done

for test_case in {1..10}; do
    file_name="speedofme/speedofme_load_${test_case}"
    echo "node ${script_path} -load -test ${test_case}"
    node ${script_path} -load
    mkdir -p results/${file_name}
    rm -rf results/${file_name}/*
    cp -R ${script_output_path} results/${file_name}/
    rm -rf ${script_output_path}/*
done

for test_case in {1..10}; do
    file_name="speedofme/speedofme_unload_${test_case}"
    echo "node ${script_path} -unload -test ${test_case}"
    node ${script_path} -unload
    mkdir -p results/${file_name}
    rm -rf results/${file_name}/*
    cp -R ${script_output_path} results/${file_name}/
    rm -rf ${script_output_path}/*
done
