const Parser = require('rss-parser');
const parser = new Parser();

exports.handler = async function (event) {
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    let body;
    try {
        body = JSON.parse(event.body);
    } catch {
        return { statusCode: 400, body: JSON.stringify({ error: "Invalid request body." }) };
    }

    const { geo, dateFrom, dateTo, dealType } = body;

    const industryKeywords = 'pharma OR biotech OR "life sciences"';
    const dealKeywords = dealType === 'all'
        ? '(M&A OR acquisition OR merger OR "joint venture" OR buyout)'
        : `"${dealType}"`;

    const geoKeyword = geo === 'all' ? '' : `AND "${geo}"`;

    const query = encodeURIComponent(`${industryKeywords} AND ${dealKeywords} ${geoKeyword}`);
    const rssUrl = `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`;

    try {
        const feed = await parser.parseURL(rssUrl);

        const deals = {
            confirmed: [],
            rumors: [],
            totalDealValue: "N/A",
            regionsFound: geo === 'all' ? ["Global"] : [geo]
        };

        const rumorKeywords = ["talks", "eyes", "considering", "exploring", "rumor", "speculation", "potential", "mulls", "weighs"];

        const items = feed.items.slice(0, 15);

        for (const item of items) {
            const titleLower = item.title.toLowerCase();
            const isRumor = rumorKeywords.some(kw => titleLower.includes(kw));

            const valueMatch = item.title.match(/\$([0-9.]+)([B|M|billion|million])/i);
            const value = valueMatch ? `$${valueMatch[1]}${valueMatch[2]}` : 'Undisclosed';

            const entities = item.title.split(' to buy ').length > 1
                ? item.title.split(' to buy ')
                : item.title.split(' acquires ');

            const acquirer = entities.length > 1 ? entities[0].split(' - ')[0] : 'Various';
            const target = entities.length > 1 ? entities[1].split(' for ')[0] : item.title.substring(0, 40) + '...';

            const dealObj = {
                acquirer: acquirer.trim(),
                target: target.trim(),
                value: value,
                geography: geo === 'all' ? 'Global' : geo,
                dealType: dealType === 'all' ? 'M&A' : dealType,
                date: new Date(item.pubDate).toISOString().split('T')[0],
                summary: item.title,
                source: item.source || item.creator || 'Google News',
                sourceUrl: item.link,
                reliability: isRumor ? 2 : 4
            };

            if (isRumor) {
                deals.rumors.push(dealObj);
            } else {
                deals.confirmed.push(dealObj);
            }
        }

        deals.confirmed = deals.confirmed.slice(0, 8);
        deals.rumors = deals.rumors.slice(0, 8);

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(deals),
        };

    } catch (err) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: err.message || "Failed to fetch from Google News RSS" }),
        };
    }
};
