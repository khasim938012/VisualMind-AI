const google = require('googlethis');

async function test() {
    try {
        const images = await google.image("Eiffel Tower", { safe: false });
        console.log("Got results:", images.length);
        if (images.length > 0) {
            console.log("First image URL:", images[0].url);
        }
    } catch(e) {
        console.error("Error:", e);
    }
}
test();
