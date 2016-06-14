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

const values = obj => Object.keys(obj).map(k => obj[k]);
const zooplaId = url => url.match(/^http:\/\/www.zoopla.co.uk\/for-sale\/details\/(\d+)/)[1];

app.post('/property', bodyParser.urlencoded({extended: false}), (req, res) => {
	zooplaDetailScraper(req.body.url).then(details => {
		const id = zooplaId(req.body.url);
		details.url = req.body.url;
		details.id = id;
		store[id] = details;
		fs.writeFile('store.json', JSON.stringify(store));
		res.redirect(`/`);
	});
});

app.post('/property/:id/delete', (req, res) => {
	delete store[req.params.id];
	fs.writeFile('store.json', JSON.stringify(store));
	res.redirect(`/`);
});

app.get('/', (req, res) => {
	const details = values(store);
	let center = details.reduce((center, detail) => ({
		lat: center.lat + parseFloat(detail.location.lat) / details.length,
		lon: center.lon + parseFloat(detail.location.lon) / details.length,
	}), {lat: 0, lon: 0});

	if(!center.lat && !center.lon) {
		center = {lat: 51.4873388, lon: -0.0979951};
	}

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
				max-width: 50%;
				height: auto;
			}
			.over {
				position: absolute;
				top: 1em;
				right: 1em;
			}
    </style>
  </head>
  <body>
    <div id="map"></div>
		<form class="over" method="post" action="/property"><input placeholder="http://www.zoopla.co.uk/for-sale/details/123456789" type="url" name="url" size="50"> <input type="submit"></form>
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
					content: ${JSON.stringify(marked(`# ${detail.address} <form method="post" action="/property/${detail.id}/delete"><button>× remove from map</button></form>
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
