#!/bin/bash

mkdir -p results/cloudflare
rm -rf results/cloudflare/*

script_path=~/rabbits-perf/cloudflare/cloudflare.js
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
            file_name="cloudflare/cloudflare_download_${param}_${timeout}_${flow}"
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
            file_name="cloudflare/cloudflare_upload_${param}_${timeout}_${flow}"
            echo "node ${script_path} -upload -size ${param} -timeout ${timeout} -flows ${flow}"
            node ${script_path} -upload -size ${param} -timeout ${timeout} -flows ${flow}
            mkdir -p results/${file_name}
            rm -rf results/${file_name}/*
            cp -R ${script_output_path} results/${file_name}/
            rm -rf ${script_output_path}/*
        done
    done
done

for test_case in {1..10}; do
    file_name="cloudflare/cloudflare_load_${test_case}"
    echo "node ${script_path} -load -test ${test_case}"
    node ${script_path} -load
    mkdir -p results/${file_name}
    rm -rf results/${file_name}/*
    cp -R ${script_output_path} results/${file_name}/
    rm -rf ${script_output_path}/*
done

for test_case in {1..10}; do
    file_name="cloudflare/cloudflare_unload_${test_case}"
    echo "node ${script_path} -unload -test ${test_case}"
    node ${script_path} -unload
    mkdir -p results/${file_name}
    rm -rf results/${file_name}/*
    cp -R ${script_output_path} results/${file_name}/
    rm -rf ${script_output_path}/*
done
