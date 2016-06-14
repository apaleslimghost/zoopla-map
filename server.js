var express = require('express');
var zooplaDetailScraper = require('zoopla-detail-scraper');
var bodyParser = require('body-parser');
var fs = require('fs');
var marked = require('marked');
var app = express();

var store;
try {
	store = require('./store.json');
} catch(e) {
	store = {};
}

app.get('/', (req, res) => {
	res.send(`<form method="post" action="/map">
	<textarea name="urls" cols="80" rows="5"></textarea>
	<input type="submit">
</form>`)
});

app.post('/map', bodyParser.urlencoded({extended: false}), (req, res) => {
	const id = Math.floor(Math.random() * 0xfffffff).toString(16);
	const urls = req.body.urls.split('\n').map(url => url.trim());
	Promise.all(urls.map(zooplaDetailScraper)).then(details => {
		store[id] = details.map((detail, i) => {
			detail.url = urls[i];
			return detail;
		});
		fs.writeFile('store.json', JSON.stringify(store));
		res.redirect(`/map/${id}`);
	});
});

app.get('/map/:id', (req, res, next) => {
	const details = store[req.params.id];
	if(!details) return next(new Error(`Map ${req.params.id} not found`));

	const center = details.reduce((center, detail) => ({
		lat: center.lat + parseFloat(detail.location.lat) / details.length,
		lon: center.lon + parseFloat(detail.location.lon) / details.length,
	}), {lat: 0, lon: 0});

	res.send(`<!DOCTYPE html>
<html>
  <head>
    <title>Zoopla Map</title>
    <meta name="viewport" content="initial-scale=1.0">
    <meta charset="utf-8">
    <style>
      html, body {
        height: 100%;
        margin: 0;
        padding: 0;
      }
      #map {
        height: 100%;
      }
			img[alt=Floorplan] {
				width: 100%;
				height: auto;
			}
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script>
      var map;
      function initMap() {
        map = new google.maps.Map(document.getElementById('map'), {
          center: {lat: ${center.lat}, lng: ${center.lon}},
          zoom: 13
        });

				${details.map((detail, i) => `
				var marker${i} = new google.maps.Marker({
			    position: {lat: ${detail.location.lat}, lng: ${detail.location.lon}},
			    map: map,
			    title: '${detail.address}'
			  });

				var info${i} = new google.maps.InfoWindow({
					content: ${JSON.stringify(marked(`# ${detail.address}
## [${detail.blurb}](${zooplaDetailScraper.toZooplaUrl(detail.url)}) ${detail.price}
${detail.description}

${detail.floorplan ? `
### Floorplan
![Floorplan](${detail.floorplan})
` : ''}`))}
				});

				marker${i}.addListener('click', function() {
					info${i}.open(map, marker${i})
				})
				`).join('')}
      }
    </script>
    <script src="https://maps.googleapis.com/maps/api/js?key=${process.env.GOOGLE_MAPS_KEY}&callback=initMap"
    async defer></script>
  </body>
</html>`);
});

app.listen(process.env.PORT || 3002);
