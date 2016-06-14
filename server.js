var express = require('express');
var zooplaDetailScraper = require('zoopla-detail-scraper');
var bodyParser = require('body-parser');
var fs = require('fs');
var app = express();

var store;
try {
	store = require('./store.json');
} catch(e) {
	store = {};
}

app.get('/', (req, res) => {
	const id = Math.floor(Math.random() * 0xfffffff).toString(16);
	res.send(`<form method="post" action="/map/${id}">
	<textarea name="urls" cols="80" rows="5"></textarea>
	<input type="submit">
</form>`)
});

app.post('/map/:id', bodyParser.urlencoded({extended: false}), (req, res) => {
	const urls = req.body.urls.split('\n').map(url => url.trim());
	Promise.all(urls.map(zooplaDetailScraper)).then(details => {
		store[req.params.id] = details;
		fs.writeFile('store.json', JSON.stringify(store));
		res.redirect(`/map/${req.params.id}`);
	});
});

app.get('/map/:id', (req, res) => {
	const details = store[req.params.id];
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

				${details.map(detail => `
				new google.maps.Marker({
			    position: {lat: ${detail.location.lat}, lng: ${detail.location.lon}},
			    map: map,
			    title: '${detail.address}'
			  });
				`).join('')}
      }
    </script>
    <script src="https://maps.googleapis.com/maps/api/js?key=${process.env.GOOGLE_MAPS_KEY}&callback=initMap"
    async defer></script>
  </body>
</html>`);
});

app.listen(process.env.PORT || 3002);
