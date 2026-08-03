const { image_search } = require('duckduckgo-images-api');

async function test() {
    try {
        const results = await image_search({ query: "Eiffel Tower", moderate: true });
        console.log("Got results:", results.length);
        if (results.length > 0) {
            console.log("First image URL:", results[0].image);
        }
    } catch(e) {
        console.error("Error:", e);
    }
}
test();
