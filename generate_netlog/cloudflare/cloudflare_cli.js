'use strict';
const readline = require('readline');

(
    async () => {

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        let speedTestTime = 3000;
        speedTestTime = await new Promise((resolve) => {
            rl.question('Enter the duration to run the speed test: ', (answer) => resolve(answer));
        });

        const size = 1 * 1024 * 1024; // 1 MB
        const measId = 6172828167751077;
        const downloadURL = `https://speed.cloudflare.com/__down?measId=${measId}&bytes=${size}`;
        const uploadURL = `https://speed.cloudflare.com/__up?measId=${measId}`
        const unloadLatencyURL = `https://speed.cloudflare.com/__down?measId=${measId}&bytes=0`;
        const loadedLatencyURLWhileDownload = 'https://speed.cloudflare.com/__down?during=download&bytes=0';
        const loadedLatencyURLWhileUpload = 'https://speed.cloudflare.com/__down?during=upload&bytes=0';

        // start download test
        let arr = [];
        let city = '', colo = '';
        const performDownload = async (url, collectData = true) => {
            try {
                const response = await fetch(url, { 
                    method: 'GET',
                    cache: "no-store" 
                });
                
                const startTime = performance.now();
                await response.blob();
                const endTime = performance.now();
                if (collectData) {
                    arr.push(endTime - startTime);
                    // return response;
                    const headers = response.headers;
                    if (city === '') city = headers.get('Cf-Meta-City');
                    if (colo === '') colo = headers.get('Cf-Meta-Colo');
                }
                return response;
            } catch(err) {
                console.log(err);
            }
        }

        let startTime = Date.now();
        while (Date.now() - startTime < speedTestTime) {
            await performDownload(downloadURL);
        }

        console.log(`City: ${city}; Colo: ${colo}`);
        console.log(arr)

        const data = new Uint8Array(size);
        const sz = size.toString();
        // start upload test
        const performUpload = (url, collectData = true) => {
            const startTime = performance.now();
            return fetch(url, { 
                method: 'POST',
                headers: {
                    "Accept": "*/*",
                    "Accept-Encoding": "gzip, deflate, br",
                    "Content-Type": "text/plain;charset=UTF-8",
                    "Content-Length": sz,
                    "Host": "speed.cloudflare.com",
                    "Origin": "https://speed.cloudflare.com",
                    "Referer": "https://speed.cloudflare.com/",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
                    "Sec-Fetch-Dest": "empty",
                    "Sec-Fetch-Mode": "cors",
                    "Sec-Fetch-Site": "same-origin"
                },
                body: data,
                cache: "no-store" 
            }).then(response => {
                const end = performance.now();
                if (collectData) arr.push(end - startTime);
            })
            .catch(err => {
                console.log(err);
            });
        };

        arr = [];
        startTime = Date.now();
        while (Date.now() - startTime < speedTestTime) {
            await performUpload(uploadURL);
        }
        console.log(arr);

        // start unloaded latency test
        const performLatencyTest = (url) => {
            const startTime = performance.now();
            return fetch(url, { 
                method: 'GET',
                cache: "no-store" 
            }).then(response => {
                const end = performance.now();
                arr.push(end - startTime);
                // const contentLength = response.headers.get('Content-Length');
            })
            .catch(err => {
                console.log(err);
            });
        };

        arr = [];
        startTime = Date.now();
        while (Date.now() - startTime < speedTestTime) {
            await performLatencyTest(unloadLatencyURL);
        }
        console.log(arr);

        // start the loaded latency test while download test is running
        const updatedSize = 100 * 1024 * 1024; // 100 MB
        let updatedDownloadURL = `https://speed.cloudflare.com/__down?measId=${measId}&bytes=${updatedSize}`;
        arr = [];
        let fetchUrlPromise = performDownload(updatedDownloadURL, false);
        startTime = Date.now();
        while (Date.now() - startTime < speedTestTime) {
            await performLatencyTest(loadedLatencyURLWhileDownload);
        }
        await fetchUrlPromise;
        console.log(arr);

        // start the loaded latency test while upload test is running
        arr = [];
        let updatedUploadURL = `https://speed.cloudflare.com/__up?measId=${measId}`;
        fetchUrlPromise = performUpload(updatedUploadURL, false);
        startTime = Date.now();
        while (Date.now() - startTime < speedTestTime) {
            await performLatencyTest(loadedLatencyURLWhileUpload);
        }
        await fetchUrlPromise;
        console.log(arr);

        rl.close();
    }
)()