var express = require('express');
var zooplaDetailScraper = require('zoopla-detail-scraper');
var bodyParser = require('body-parser');
var fs = require('fs');
var marked = require('marked');
var path = require('path');
var MongoClient = require('mongodb').MongoClient;
var assertEnv = require('@quarterto/assert-env');
var app = express();

assertEnv(['GOOGLE_MAPS_KEY', 'MONGO_URL']);

app.use((req, res, next) => {
	MongoClient.connect(process.env.MONGO_URL).then(db => {
		req.db = db;
		next();
	}).catch(next);
});

const values = obj => Object.keys(obj).map(k => obj[k]);
const zooplaId = url => url.match(/^http:\/\/www.zoopla.co.uk\/for-sale\/details\/(\d+)/)[1];

app.post('/property', bodyParser.urlencoded({extended: false}), (req, res, next) => {
	zooplaDetailScraper(req.body.url).then(details => {
		const id = zooplaId(req.body.url);
		details.url = req.body.url;
		details._id = id;
		return req.db.collection('properties').insertOne(details);
	}).then(() => {
		res.redirect(`/`);
	}).catch(next);
});

app.post('/property/:id/delete', (req, res, next) => {
	req.db.collection('properties').deleteOne({_id: req.params.id}).then(() => {
		res.redirect(`/`);
	}).catch(next);
});

app.get('/', (req, res, next) => {
	req.db.collection('properties').find({}).toArray().then(details => {
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
					content: ${JSON.stringify(marked(`# ${detail.address} <form method="post" action="/property/${detail._id}/delete"><button>× remove from map</button></form>
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
	}).catch(next);
});

app.listen(process.env.PORT || 3002);
