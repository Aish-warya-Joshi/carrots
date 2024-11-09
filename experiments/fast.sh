#!/bin/bash

params=(
    "1"
    "2"
    "3"
    "4"
    "5"
)

mkdir -p results/fast
rm -rf results/fast/*

script_path=~/rabbits-perf/fast/fast.js
script_output_path=~/output

rm -rf ${script_output_path}/*

for server in "${params[@]}"; do
    file_name="fast/fast_download_${server}"
    node ${script_path} -download -server ${server}
    mkdir -p results/${file_name}
    rm -rf results/${file_name}/*
    cp -R ${script_output_path} results/${file_name}/
    rm -rf ${script_output_path}/*

    file_name="fast/fast_upload_${server}"
    node ${script_path} -upload -server ${server}
    mkdir -p results/${file_name}
    rm -rf results/${file_name}/*
    cp -R ${script_output_path} results/${file_name}/
    rm -rf ${script_output_path}/*

    file_name="fast/fast_load_${server}"
    node ${script_path} -load -server ${server}
    mkdir -p results/${file_name}
    rm -rf results/${file_name}/*
    cp -R ${script_output_path} results/${file_name}/
    rm -rf ${script_output_path}/*

    file_name="fast/fast_unload_${server}"
    node ${script_path} -unload -server ${server}
    mkdir -p results/${file_name}
    rm -rf results/${file_name}/*
    cp -R ${script_output_path} results/${file_name}/
    rm -rf ${script_output_path}/*
done
