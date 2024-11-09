'use strict'
const puppeteer = require('puppeteer');
const readline = require('readline');
const fs = require('fs');
var program = require('commander');

var tracename = "fast";

function waitFor(conditionFunction) {
    const poll = resolve => {
        if (conditionFunction()) resolve();
        else setTimeout(_ => poll(resolve), 400);
    }
    return new Promise(poll);
}

program
    .version('0.0.1')
    .option('-download, --download', 'Download speed test')
    .option('-upload, --upload', 'Upload speed test')
    .option('-load, --load', 'Loaded latency test')
    .option('-unload, --unload', 'Unloaded latency test')
    .option('-server, --server [value]', 'specify the server to test')
    .option('-size, --object_size [value]', 'specify object size (default 10MB for download, 1MB for upload)')
    .option('-timeout, --timeout [value]', 'specify timeout (default 10000)', 10000)
    .option('-flows, --flows [value]', 'specify number of flows (default 3)', 3)
    .parse(process.argv);

const option = program.opts();

var dir = './output';
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
}

(
    async () => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        var tracejson = "./output/" + tracename + ".json";
        var urlsfilename = "./output/" + tracename + "_urls.txt";

        var keyarg = "--ssl-key-log-file=./output/" + tracename + ".key";
        var netlogarg = "--log-net-log=./output/" + tracename + ".netlog";
        console.log("fast test:" + tracejson);
        const browser = await puppeteer.launch({ headless: 'new', args: [keyarg, netlogarg, '--no-sandbox'], protocolTimeout: 1000000 })
        const page = await browser.newPage();

        await page.tracing.start({ path: tracejson, categories: ['devtools.timeline', 'blink.user_timing'] })

        // Navigate to an empty page
        await page.goto('about:blank');
        await page.setRequestInterception(true);

        let size;
        if (option.object_size) {
            size = option.object_size;
        } else if (option.download) {
            size = 10485760; // 10MB default size for download
        } else {
            size = 1048576; // 1MB default size for upload
        }
        const num_requests = option.flows ? option.flows : 3;

        let urlJson = {
            "download": [],
            "upload": [],
            "load": [],
            "unload": []
        };
        let available_servers = [];
        var server_url;
        let serversFound = false;
        const timeout = option.timeout;

        page.on('request', async (request) => {
            request.continue();
        });

        page.on('response', async (response) => {
            if (response.url().includes('urlCount')) {
                const data = await response.json();
                for (let i = 0; i < data['targets'].length; i++) {
                    server_url = data['targets'][i]['url'];
                    const match = server_url.match(/-([a-zA-Z0-9-]+)-/);
                    const serverId = match[1];
                    available_servers.push({ server_url, serverId });
                }
                serversFound = true;
            }
        });

        var testDone = false;
        const sendDownloadRequest = (page, url) => {
            page.evaluate((url) => {
                try {
                    const xhr = new XMLHttpRequest();

                    function handleLoadEnd(event) {
                        console.log('XMLHttpRequest loadend event:', event);
                        console.log('Response text:', xhr.responseText);
                    }

                    xhr.addEventListener('loadend', handleLoadEnd);
                    xhr.open('GET', url, true);
                    xhr.send();
                    return xhr.responseText;
                } catch (err) {
                    console.log(err);
                    return err;
                }
            }, url);
        }

        const sendUploadRequest = (page, url, data_length) => {
            page.evaluate((url, data_length) => {
                try {
                    const data = new Uint8Array(data_length);
                    const xhr = new XMLHttpRequest();

                    xhr.upload.addEventListener('loadend', event => {
                        console.log('Upload loadend event:', event);
                    });

                    xhr.upload.addEventListener('progress', event => {
                        console.log(`Upload progress: ${event.loaded} of ${event.total} bytes uploaded`);
                    });

                    xhr.open('POST', url, true);
                    xhr.setRequestHeader('Accept', '*/*');
                    xhr.setRequestHeader('Accept-Encoding', 'gzip, deflate, br');
                    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
                    xhr.setRequestHeader('Content-Length', data.length);
                    xhr.setRequestHeader('Origin', 'https://fast.com');
                    xhr.setRequestHeader('Referer', 'https://fast.com/');
                    xhr.setRequestHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
                    xhr.send(data);
                    return xhr.responseText;
                } catch (err) {
                    console.log(err);
                    return err;
                }
            }, url, data_length);
        }

        page.on('console', msg => {
            if (msg.text().includes("loadend")) {
                console.log(msg.text());
                console.log(request_url);
                if (!testDone) {
                    if (option.download) {
                        urlJson.download.push(request_url);
                        sendDownloadRequest(page, request_url)
                    }
                    else if (option.upload) {
                        urlJson.upload.push(request_url);
                        sendUploadRequest(page, request_url, size);
                    }
                }
            }
        });

        await new Promise(r => setTimeout(r, 5000));

        const token = "YXNkZmFzZGxmbnNkYWZoYXNkZmhrYWxm";
        var url = `https://api.fast.com/netflix/speedtest/v2?https=true&token=${token}&urlCount=5`;
        await page.evaluate((url) => {
            try {
                const xhr = new XMLHttpRequest();
                xhr.open('GET', url, true);
                xhr.send();
                return xhr.responseText;
            } catch (err) {
                console.log(err);
                return err;
            }
        }, url);

        await waitFor(_ => serversFound === true);
        console.log("Select an option:");
        available_servers.forEach((option, index) => {
            console.log(`${index + 1}. ${option.serverId}`);
        });

        // let choice = await new Promise((resolve) => {
        //     rl.question('Enter your choice: ', (answer) => resolve(answer));
        // });
        let choice = 1;
        if (option.server) {
            choice = parseInt(option.server);
        }
        console.log(available_servers[choice - 1].server_url);

        url = new URL(available_servers[choice - 1].server_url);

        url.pathname = `/speedtest/range/0-${size}`;
        let request_url = url.toString();

        if (option.download) {
            // Start download speed test
            Array.from({ length: num_requests }, () => {
                urlJson.download.push(request_url);
                sendDownloadRequest(page, request_url);
            }, num_requests);

            await new Promise(r => setTimeout(r, timeout));
            testDone = true;
        }

        if (option.upload) {
            // Start upload speed test
            const data_length = size;
            Array.from({ length: num_requests }, () => {
                urlJson.upload.push(request_url);
                sendUploadRequest(page, request_url, data_length);
            }, num_requests);

            await new Promise(r => setTimeout(r, timeout));
            testDone = true;
        }

        if (option.unload) {
            // Start unloaded latency test
            url.pathname = "/speedtest/range/0-0";
            // console.log(url.toString())
            let latency_request_url = url.toString();
            let start = performance.now();
            while (performance.now() - start < timeout) {
                await new Promise(r => setTimeout(r, 200));
                urlJson.unload.push(latency_request_url);
                await page.evaluate((url) => {
                    try {
                        const xhr = new XMLHttpRequest();
                        xhr.open('GET', url, true);
                        xhr.send();
                        return xhr.responseText;
                    } catch (err) {
                        console.log(err);
                        return err;
                    }
                }, latency_request_url);
            }
        }

        if (option.load) {
            // Start loaded latency test
            // first start a download request to load the server
            url.pathname = `/speedtest/range/0-${size * 100}`;
            request_url = url.toString();
            Array.from({ length: 4 }, () => {
                urlJson.download.push(request_url);
                return page.evaluate((url) => {
                    try {
                        const xhr = new XMLHttpRequest();
                        xhr.open('GET', url, true);
                        xhr.send();
                        return xhr.responseText;
                    } catch (err) {
                        console.log(err);
                        return err;
                    }
                }, request_url);
            }, num_requests);

            // then start the loaded latency test
            url.pathname = "/speedtest/range/0-0";
            // console.log(url.toString())
            let latency_request_url = url.toString();
            let start = performance.now();
            let cnt = 1;
            while (performance.now() - start < timeout) {
                await new Promise(r => setTimeout(r, 100));
                urlJson.load.push(latency_request_url);
                await page.evaluate((url) => {
                    try {
                        const xhr = new XMLHttpRequest();
                        xhr.open('GET', url, true);
                        xhr.send();
                        return xhr.responseText;
                    } catch (err) {
                        console.log(err);
                        return err;
                    }
                }, latency_request_url);

                if (performance.now() - start > 1800 * cnt) {
                    cnt++;
                    Array.from({ length: 4 }, () => {
                        urlJson.download.push(request_url);
                        return page.evaluate((url) => {
                            try {
                                const xhr = new XMLHttpRequest();
                                xhr.open('GET', url, true);
                                xhr.send();
                                return xhr.responseText;
                            } catch (err) {
                                console.log(err);
                                return err;
                            }
                        }, request_url);
                    }, num_requests);
                }
            }
        }

        // await new Promise(r => setTimeout(r, 500));
        console.log("test done")
        await page.tracing.stop();
        await browser.close();
        // fs.writeFileSync(urlsfilename, urls.join('\n'));
        const jsonString = JSON.stringify(urlJson);
        fs.writeFileSync(urlsfilename, jsonString);
        rl.close();
    }
)()
