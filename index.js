const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const port = process.env.PORT || 3000;

// Заголовки, имитирующие запрос из браузера
const headersBase = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
};

// Функция для преобразования URL
function transformVideoUrl(url) {
    const regex = /video-?(\d+)_(\d+)/;
    const match = url.match(regex);
    if (match) {
        const [, oid, id] = match;
        return `https://vk.com/video_ext.php?oid=-${oid}&id=${id}`;
    }
    throw new Error('Invalid video URL');
}

// Функция для извлечения видео URL из HTML страницы
async function extractVideoUrls(playerUrl) {
    try {
        const response = await axios.get(playerUrl, { headers: headersBase });
        const $ = cheerio.load(response.data);

        const scriptTags = $('script').filter((i, script) => {
            return $(script).html().includes('var playerParams =');
        });

        if (scriptTags.length === 0) {
            console.log('Script containing playerParams not found');
            return [];
        }

        let playerParams;
        scriptTags.each((_, element) => {
            const content = $(element).html();
            const regex = /var playerParams = ({.*?});/s;
            const match = content.match(regex);
            if (match) {
                try {
                    playerParams = JSON.parse(match[1]);
                    return false; // Break the loop
                } catch (e) {
                    console.log('Error parsing JSON:', e);
                }
            }
        });

        if (!playerParams) {
            console.log('playerParams not found or could not be parsed');
            return [];
        }

        const result = [];

        // Проверяем различные возможные структуры данных
        const videoData = playerParams.params && playerParams.params[0] || playerParams;

       if (videoData) {
            for (const [key, value] of Object.entries(videoData)) {
                if (key.startsWith('url') && value) {
                    const quality = key.replace('url', '') + 'p';
                    result.push({
                        "quality": quality,
                        "url": value,
                    });
                }
            }
        }

        return result;
    } catch (error) {
        console.error('Error in extractVideoUrls:', error);
        throw new Error(`Error fetching video URLs: ${error.message}`);
    }
}

// Ендпоинт для парсинга и получения прямых ссылок на видео
app.get('/video/parse', async (req, res) => {
    const videoUrl = req.query.url;

    if (!videoUrl) {
        return res.status(400).json({ error: 'Missing URL parameter' });
    }

    try {
        const transformedUrl = transformVideoUrl(videoUrl);
        const videoUrls = await extractVideoUrls(transformedUrl);
        res.json(videoUrls);
    } catch (error) {
        console.error('Error in /video/parse:', error);
        res.status(500).json({
            error: 'Internal server error',
            details: error.message,
        });
    }
});

// Запуск сервера
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});