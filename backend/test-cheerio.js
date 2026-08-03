const axios = require('axios');
const cheerio = require('cheerio');

async function test() {
    try {
        const query = "Eiffel Tower";
        const url = `https://images.search.yahoo.com/search/images?p=${encodeURIComponent(query)}`;
        
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        
        const $ = cheerio.load(response.data);
        const images = [];
        $('img').each((i, el) => {
            const src = $(el).attr('data-src') || $(el).attr('src');
            if (src && src.startsWith('http')) {
                images.push(src);
            }
        });
        
        console.log("Found images:", images.length);
        if (images.length > 0) {
            console.log("First image:", images[0]);
            console.log("Second image:", images[1]);
        }
    } catch(e) {
        console.error(e);
    }
}
test();
