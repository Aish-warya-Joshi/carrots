'use strict'
const puppeteer = require('puppeteer');
const fs = require('fs');
var program = require('commander');

var tracename = "speedofme";

program
    .version('0.0.1')
    .option('-download, --download', 'Download speed test')
    .option('-upload, --upload', 'Upload speed test')
    .option('-load, --load', 'Loaded latency test')
    .option('-unload, --unload', 'Unloaded latency test')
    .option('-timeout, --timeout [value]', 'specify timeout (default 10000)', 10000)
    .option('-size, --object_size [value]', 'specify object size (default 10MB for download, 10MB for upload)')
    .option('-flows, --flows [value]', 'specify number of flows (default 3)', 3)
    .parse(process.argv);

function getRandomNumber() {
    const max = 9999999999999999;
    const seed = new Date().getTime();
    const randomValue = Math.floor(Math.random() * (max + 1));
    const seededRandom = (randomValue + seed) % (max + 1) + 1;
    return seededRandom;
}

const option = program.opts();

var dir = './output';
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
}

(
    async () => {
        var tracejson = "./output/" + tracename + ".json";
        var urlsfilename = "./output/" + tracename + "_urls.txt";

        var keyarg = "--ssl-key-log-file=./output/" + tracename + ".key";
        var netlogarg = "--log-net-log=./output/" + tracename + ".netlog";
        console.log("speedofme test:" + tracejson);
        const browser = await puppeteer.launch({
            headless: 'new', args: [keyarg, netlogarg, '--disable-web-security',
                '--disable-http2', '--no-sandbox']
        })
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
            size = 10485760; // 10MB default size for upload
        }
        const num_requests = option.flows ? option.flows : 3;

        let urlJson = {
            "download": [],
            "upload": [],
            "load": [],
            "unload": []
        };
        const timeout = option.timeout;

        page.on('request', async (request) => {
            const headers = request.headers();
            headers['Referer'] = 'https://speedof.me';
            request.continue({ headers });
        });

        const sendDownloadRequest = (page, url, size) => {
            page.evaluate((url, data_size) => {
                try {
                    const xhr = new XMLHttpRequest();

                    function handleLoadEnd(event) {
                        console.log('XMLHttpRequest loadend event:', event);
                        console.log('Response text:', xhr.responseText);
                    }

                    xhr.addEventListener('loadend', handleLoadEnd);
                    xhr.open('GET', url, true);
                    xhr.setRequestHeader('Range', `bytes=0-${data_size - 1}`);
                    xhr.send();
                    return xhr.responseText;
                } catch (err) {
                    console.log(err);
                    return err;
                }
            }, url, size);
        }

        const sendUploadRequest = (page, url, size) => {
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
                    xhr.setRequestHeader('Accept-Encoding', 'gzip, deflate, br, zstd');
                    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
                    xhr.setRequestHeader('Content-Length', data_length);
                    xhr.setRequestHeader('Host', 'speed.cloudflare.com');
                    xhr.setRequestHeader('Origin', 'https://speedof.me');
                    xhr.setRequestHeader('Referer', 'https://speedof.me/');
                    xhr.setRequestHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
                    xhr.setRequestHeader('Sec-Fetch-Dest', 'empty');
                    xhr.setRequestHeader('Sec-Fetch-Mode', 'cors');
                    xhr.setRequestHeader('Sec-Fetch-Site', 'same-origin');
                    xhr.send(data);
                    return xhr.responseText;
                } catch (err) {
                    console.log(err);
                    return err;
                }
            }, url, size);
        }

        var testDone = false;
        page.on('console', msg => {
            if (msg.text().includes("loadend")) {
                console.log(msg.text());
                if (!testDone) {
                    if (option.download) {
                        const downloadURL = `https://cdn.speedof.me/sf/sample16384k.bin?r=0.${getRandomNumber()}`;
                        urlJson.download.push(downloadURL);
                        sendDownloadRequest(page, downloadURL, size);
                    }
                    else if (option.upload) {
                        const uploadURL = 'https://cdn.speedof.me/ul';
                        urlJson.upload.push(uploadURL);
                        sendUploadRequest(page, uploadURL, size);
                    }
                }
            }
            if (msg.text().includes("progress")) {
                console.log(msg.text())
            }
        });

        await new Promise(r => setTimeout(r, 5000));

        if (option.download) {
            const generateDownloadURL = () => `https://cdn.speedof.me/sf/sample16384k.bin?r=0.${getRandomNumber()}`;
            let downloadURLs = Array.from({ length: num_requests }, () => generateDownloadURL());
            downloadURLs.forEach(url => {
                urlJson.download.push(url);
                sendDownloadRequest(page, url, size);
            });
            await new Promise(r => setTimeout(r, timeout));
            testDone = true;
        }

        if (option.upload) {
            const uploadURL = 'https://cdn.speedof.me/ul';
            Array.from({ length: num_requests }, () => {
                urlJson.upload.push(uploadURL);
                sendUploadRequest(page, uploadURL, size);
            }, num_requests);
            await new Promise(r => setTimeout(r, timeout));
            testDone = true;
        }

        if (option.unload) {
            // const unloadURL = `https://cdn.speedof.me/sf/?r=0.${getRandomNumber()}`;
            const generateUnloadURL = () => `https://cdn.speedof.me/sf/?r=0.${getRandomNumber()}`;
            let unloadURLs = Array.from({ length: num_requests }, () => generateUnloadURL());
            let start = performance.now();
            while (performance.now() - start < timeout) {
                unloadURLs.forEach(url => {
                    urlJson.unload.push(url);
                    page.evaluate((url) => {
                        try {
                            const xhr = new XMLHttpRequest();
                            xhr.open('HEAD', url, true);
                            xhr.send();
                            return xhr.responseText;
                        } catch (err) {
                            console.log(err);
                            return err;
                        }
                    }, url);
                });
                unloadURLs = Array.from({ length: num_requests }, () => generateUnloadURL());
                await new Promise(r => setTimeout(r, 200));
            }
        }

        if (option.load) {
            // start loaded latency test
            // first start a download request to load the server
            const generateDownloadURL = () => `https://cdn.speedof.me/sf/sample131072k.bin?r=0.${getRandomNumber()}`;
            let downloadURLs = Array.from({ length: 4 }, () => generateDownloadURL());
            downloadURLs.forEach(url => {
                urlJson.download.push(url);
                page.evaluate((url) => {
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
            });

            // then start the loaded latency test
            let loadURL;
            let start = performance.now();
            while (performance.now() - start < timeout) {
                loadURL = `https://cdn.speedof.me/sf/?r=0.${getRandomNumber()}`;
                urlJson.load.push(loadURL);
                await page.evaluate((url) => {
                    try {
                        const xhr = new XMLHttpRequest();
                        xhr.open('HEAD', url, true);
                        xhr.send();
                        return xhr.responseText;
                    } catch (err) {
                        console.log(err);
                        return err;
                    }
                }, loadURL);
                await new Promise(r => setTimeout(r, 1000));
            }
        }

        console.log("Test done")
        await page.tracing.stop();
        await browser.close();
        await new Promise(r => setTimeout(r, 400));
        // fs.writeFileSync(urlsfilename, urls.join('\n'));
        const jsonString = JSON.stringify(urlJson);
        fs.writeFileSync(urlsfilename, jsonString);
    }
)()