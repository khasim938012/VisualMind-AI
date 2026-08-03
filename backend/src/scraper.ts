import axios from 'axios';

export const fetchWebContext = async (query: string): Promise<string> => {
    try {
        // We use Wikipedia for reliable, free, API-keyless real-time data
        // Extract main keywords from query. Simple approach: just pass the query.
        const headers = { 'User-Agent': 'VisualMindAI/1.0 (contact@example.com)' };
        const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=&format=json`;
        const searchRes = await axios.get(searchUrl, { headers });
        
        if (searchRes.data.query.search.length > 0) {
            const topResult = searchRes.data.query.search[0].title;
            const detailUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro&titles=${encodeURIComponent(topResult)}&format=json`;
            const detailRes = await axios.get(detailUrl, { headers });
            
            const pages = detailRes.data.query.pages;
            const pageId = Object.keys(pages)[0];
            const extractText = pages[pageId].extract.replace(/<\/?[^>]+(>|$)/g, ""); // strip HTML
            
            return `From Wikipedia (${topResult}): ${extractText.substring(0, 500)}...`;
        }
        return '';
    } catch (error) {
        console.error("Web scraping error:", error);
        return '';
    }
};
