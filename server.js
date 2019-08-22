'use strict';

const express = require('express');
const cors = require('cors');
//superagent talks to the internet over http
const superagent = require('superagent');
require('dotenv').config()
const app = express();
app.use(cors());

const PORT = process.env.PORT;

const GEOCODE_API_KEY = process.env.googleMapsAPI;
const WEATHER_API_KEY = process.env.darkSkyAPI;
const EVENTS_API_KEY = process.env.eventBriteAPI;

let latTemp = '';
let longTemp = '';

function Location(query, format, lat, lng){
  this.search_query = query;
  this.formatted_query = format;
  this.latitude = lat;
  this.longitude = lng;
}

function Day(summary, time){
  this.forecast = summary;
  this.time = new Date(time *1000).toDateString();
}

function Eventbrite(url, name, date, summary){
  this.link = url;
  this.name = name;
  this.event_date = new Date(date).toDateString();
  this.summary = summary;
}

app.get('/location', (request, response) => {
  const query = request.query.data;

  const urlToVisit = `https://maps.googleapis.com/maps/api/geocode/json?address=${query}&key=${GEOCODE_API_KEY}`
  console.log(urlToVisit);
  // superagent.get('url as a string');
  superagent.get(urlToVisit).then(responseFromSuper => {
    // console.log('stuff for location', responseFromSuper.body);

    // I simply replaced my geodata require, with the data in the body of my superagent response
    const geoData = responseFromSuper.body;

    const specificGeoData = geoData.results[0];

    const formatted = specificGeoData.formatted_address;
    const lat = specificGeoData.geometry.location.lat;
    const lng = specificGeoData.geometry.location.lng;

    latTemp = lat;
    longTemp = lng;

    const newLocation = new Location(query, formatted, lat, lng)
    console.log(newLocation);
    response.send(newLocation);
  }).catch(error => {
    response.status(500).send(error.message);
    console.error(error);
  })
})


function getWeather(request, response){
  const urlToVisit = `https://api.darksky.net/forecast/${WEATHER_API_KEY}/${latTemp},${longTemp}`

  superagent.get(urlToVisit).then(responseFromSuper => {

    const weatherData = responseFromSuper.body;
    const eightDays = weatherData.daily.data;

    const formattedDays = eightDays.map(day => new Day(day.summary, day.time));

    response.send(formattedDays);
  }).catch(error => {
    response.status(500).send(error.message);
    console.error(error);
  })
}

function getEvents(request, response) {
  const urlToVisit = `https://www.eventbriteapi.com/v3/events/search?location.longitude=${longTemp}&location.latitude=${latTemp}&token=${EVENTS_API_KEY}`;

  superagent.get(urlToVisit).then(responseFromSuper => {

    const eventData = responseFromSuper.body;

    const formattedEvent = eventData.events.map(event => new Eventbrite(event.url, event.name.text, event.start.local, event.summary));

    response.send(formattedEvent);

  }).catch(error => {
    response.status(500).send(error.message);
    console.error(error);
  })
}

app.get('/weather', getWeather)
app.get('/events', getEvents)

app.listen(PORT, () => {console.log(`app is up on PORT ${PORT}`)});
