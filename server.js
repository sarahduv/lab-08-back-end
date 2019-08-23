'use strict';

// Requires
require('dotenv').config()
const express = require('express');
const cors = require('cors');
const superagent = require('superagent');
const app = express();
const pg = require('pg');

// Env variables
const GEOCODE_API_KEY = process.env.googleMapsAPI;
const WEATHER_API_KEY = process.env.darkSkyAPI;
const EVENTS_API_KEY = process.env.eventBriteAPI;
const PORT = process.env.PORT;
const DATABASE_URL = process.env.DATABASE_URL;

app.use(cors());

// Connect to database
const client = new pg.Client(DATABASE_URL);
client.connect();
client.on('error', (error) => console.log(error));

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

function updateLocation(query, request, response) {
  const urlToVisit = `https://maps.googleapis.com/maps/api/geocode/json?address=${query}&key=${GEOCODE_API_KEY}`
  superagent.get(urlToVisit).then(responseFromSuper => {

    // I simply replaced my geodata require, with the data in the body of my superagent response
    const geoData = responseFromSuper.body;
    const specificGeoData = geoData.results[0];
    const newLocation = new Location(
      query,
      specificGeoData.formatted_address,
      specificGeoData.geometry.location.lat,
      specificGeoData.geometry.location.lng
    )

    //Logging data into the SQL DB
    const sqlQueryInsert = `
      INSERT INTO locations (search_query, formatted_query, latitude, longitude)
      VALUES ($1, $2, $3, $4);`;
    const valuesArray = [newLocation.search_query, newLocation.formatted_query, newLocation.latitude, newLocation.longitude];

    //client.query takes in a string and array and smooshes them into a proper sql statement that it sends to the db
    client.query(sqlQueryInsert, valuesArray);
    response.send(newLocation);        
  }).catch(error => {
    response.status(500).send(error.message);
    console.error(error);
  })
}

function updateWeather(query, request, response){
  const urlToVisit = `https://api.darksky.net/forecast/${WEATHER_API_KEY}/${request.query.data.latitude},${request.query.data.longitude}`
  superagent.get(urlToVisit).then(responseFromSuper => {        
    const formattedDays = responseFromSuper.body.daily.data.map(
      day => new Day(day.summary, day.time)
    );
    response.send(formattedDays);

    //Logging data into the SQL DB
    formattedDays.forEach(day => {
      const sqlQueryInsert = `
        INSERT INTO weather (search_query, forecast, time)
        VALUES ($1, $2, $3);`;
      const valuesArray = [query.search_query, day.forecast, day.time]

      //client.query takes in a string and array and smooshes them into a proper sql statement that it sends to the db
      client.query(sqlQueryInsert, valuesArray);
    })
  }).catch(error => {
    response.status(500).send(error.message);
    console.error(error);
  });
}

function updateEvents(query, request, response){
  const urlToVisit = `https://www.eventbriteapi.com/v3/events/search?location.longitude=${request.query.data.longitude}&location.latitude=${request.query.data.latitude}&token=${EVENTS_API_KEY}`;
  superagent.get(urlToVisit).then(responseFromSuper => {
    const formattedEvent = responseFromSuper.body.events.map(
      event => new Eventbrite(event.url, event.name.text, event.start.local, event.summary)
    );
    response.send(formattedEvent);
    //Logging data into the SQL DB
    formattedEvent.forEach(event => {
      const sqlQueryInsert = `
        INSERT INTO events (search_query, link, name, event_date, summary)
        VALUES ($1, $2, $3, $4, $5);`;
      const valuesArray = [query.search_query, event.link, event.name, event.event_date, event.summary];

      //client.query takes in a string and array and smooshes them into a proper sql statement that it sends to the db
      client.query(sqlQueryInsert, valuesArray);
    })
  }).catch(error => {
    response.status(500).send(error.message);
    console.error(error);
  })
}

function getLocation(request, response) {
  const query = request.query.data;
  client.query(`SELECT * FROM locations WHERE search_query=$1`, [query]).then(sqlResult => {
    if(sqlResult.rowCount > 0){
      console.log('I found stuff in the DB! :D')
      response.send(sqlResult.rows[0]);
    } else {
      updateLocation(query, request, response);
    }
  });
}


function getWeather(request, response){
  const query = request.query.data;
  client.query(`SELECT * FROM weather WHERE search_query=$1`, [query]).then(sqlResult => {
    if(sqlResult.rowCount > 0){
      console.log('I found stuff in the DB! :D')
      response.send(sqlResult.rows[0]);
    } else {
      updateWeather(query, request, response);
    }
  });
}

function getEvents(request, response) {
  const query = request.query.data;
  client.query(`SELECT * FROM events WHERE search_query=$1`, [query]).then(sqlResult => {
    if(sqlResult.rowCount > 0){
      console.log('I found stuff in the DB! :D')
      response.send(sqlResult.rows[0]);
    } else {
      updateEvents(query, request, response);
    }
  });
}

app.get('/location', getLocation);
app.get('/weather', getWeather);
app.get('/events', getEvents);

app.listen(PORT, () => {console.log(`app is up on PORT ${PORT}`)});
