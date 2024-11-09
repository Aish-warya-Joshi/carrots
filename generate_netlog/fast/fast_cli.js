'use strict';
const readline = require('readline');

(
    async () => {
        let available_servers = [];
        var token = "YXNkZmFzZGxmbnNkYWZoYXNkZmhrYWxm";
        var server_url;
        await fetch(`https://api.fast.com/netflix/speedtest/v2?https=true&token=${token}&urlCount=5`)
            .then(response => {
                return response.json();
            }).then(data => {
                for (let i = 0; i < data['targets'].length; i++) {
                    server_url = data['targets'][i]['url'];
                    const match = server_url.match(/-([a-zA-Z0-9-]+)-/);
                    const serverId = match[1];
                    available_servers.push({ server_url, serverId });
                }
            }).catch(err => {
                console.log(err);
            });

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        console.log("Select an option:");
        available_servers.forEach((option, index) => {
            console.log(`${index + 1}. ${option.serverId}`);
        });

        let choice = await new Promise((resolve) => {
            rl.question('Enter your choice: ', (answer) => resolve(answer));
        });

        let speedTestTime = 3000;
        speedTestTime = await new Promise((resolve) => {
            rl.question('Enter the duration to run the speed test: ', (answer) => resolve(answer));
        });

        // function to get the average of an array
        const get_array_average = (arr) => {
            let sum = 0;
            arr.forEach((item) => {
                sum += item;
            });
            return sum / arr.length;
        };

        let arr = [];

        var url = new URL(available_servers[choice - 1].server_url);
        // For 1 MB download requests
        url.pathname = "/speedtest/range/0-1048576";
        // console.log(url.toString())
        const request_url = url.toString();
        const num_requests = 2;

        const urls = Array.from({ length: num_requests }, () => request_url);
        
        const performFetch = async (url, collectData = true) => {
            try {
                const response = await fetch(url, { 
                    method: 'GET',
                    cache: "no-store" 
                });

                const startTime = performance.now();
                await response.blob();
                const endTime = performance.now();
                if(collectData) {
                    arr.push(endTime - startTime);
                }
                // const contentLength = response.headers.get('Content-Length');
            } catch(err) {
                console.log(err);
            }
        };

        let startTime = Date.now();
        while (Date.now() - startTime < speedTestTime) {
            const fetchPromises = urls.map(url => performFetch(url));
            await Promise.all(fetchPromises);
        }
        // console.log(arr);
        console.log("Avg download time: ", get_array_average(arr));


        // Make a preflight request before starting the upload speed test
        // await fetch(request_url, {
        //     method: 'OPTIONS',
        //     headers: {
        //         "Accept": "*/*",
        //         "Accept-Encoding": "gzip, deflate, br",
        //         "Access-Control-Request-Headers": "content-type",
        //         "Access-Control-Request-Method": "POST",
        //         "Origin": "https://fast.com",
        //         "Referer": "https://fast.com/",
        //         "Sec-Fetch-Dest": "empty",
        //         "Sec-Fetch-Mode": "cors",
        //         "Sec-Fetch-Site": "cross-site",
        //         "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        //     }
        // }).then(preflightResponse => {
        //     if(!preflightResponse.ok) {
        //         throw new Error('Preflight request failed');
        //     }
        //     console.log("Preflight request successful")
        // }).catch(err => {
        //     console.log(err);
        // });

        // Start upload speed test
        const data = new Uint8Array(1048576);
        arr = [];
        const performUpload = (url) => {
            const startTime = performance.now();
            return fetch(url, { 
                method: 'POST',
                headers: {
                    "Accept": "*/*",
                    "Accept-Encoding": "gzip, deflate, br",
                    "Content-Type": "application/octet-stream",
                    "Content-Length": "1048576",
                    "Origin": "https://fast.com",
                    "Referer": "https://fast.com/",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                },
                body: data,
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

        startTime = Date.now();
        while (Date.now() - startTime < speedTestTime) {
            const fetchPromises = urls.map(url => performUpload(url));
            await Promise.all(fetchPromises);
        }
        // console.log(arr);
        console.log("Avg upload time: ", get_array_average(arr));

        // start the unloaded latency test
        arr = [];
        const performLatencyTest = (url) => {
            const startTime = performance.now();
            return fetch(url, { 
                method: 'POST',
                headers: {
                    "Accept": "*/*",
                    "Accept-Encoding": "gzip, deflate, br",
                    "Content-Type": "application/octet-stream",
                    "Content-Length": "1048576",
                    "Origin": "https://fast.com",
                    "Referer": "https://fast.com/",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                },
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

        startTime = Date.now();
        while (Date.now() - startTime < speedTestTime) {
            url.pathname = "/speedtest/range/0-0";
            await performLatencyTest(url.toString());
        }
        // console.log(arr);
        console.log("Avg unloaded latency: ", get_array_average(arr));

        // start the loaded latency test
        const performLoadedLatencyTest = (url) => {
            const startTime = performance.now();
            return fetch(url, { 
                method: 'POST',
                headers: {
                    "Accept": "*/*",
                    "Accept-Encoding": "gzip, deflate, br",
                    "Content-Type": "application/octet-stream",
                    "Content-Length": "1048576",
                    "Origin": "https://fast.com",
                    "Referer": "https://fast.com/",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                },
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

        url.pathname = "/speedtest/range/0-524288000";
        const loaded_url = new URL(available_servers[choice - 1].server_url);
        loaded_url.pathname = "/speedtest/range/0-0";

        arr = [];
        const fetchUrlPromise = performFetch(url.toString(), false);
        startTime = Date.now();
        while (Date.now() - startTime < speedTestTime) {
            await performLoadedLatencyTest(loaded_url.toString());
        }
        await fetchUrlPromise;
        // console.log(arr);
        console.log("Avg loaded latency: ", get_array_average(arr));

        rl.close();
    }
)()
