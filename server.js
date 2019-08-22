'use strict';

const express = require('express');
const cors = require('cors');
//superagent talks to the internet over http
const superagent = require('superagent');
require('dotenv').config()
const app = express();
const pg = require('pg');
app.use(cors());

const PORT = process.env.PORT;
const client = new pg.Client(process.env.DATABASE_URL);
client.connect();
client.on('error', (error) => console.log(error));

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

// function lookUp(queryIn){
//   client.query(`SELECT * FROM locations WHERE search_query=$1`, [queryIn]).then(sqlResult => {
//     if(sqlResult.rowCount > 0){
//       return true;
//     } else {
//       return false;
//     }
//   })
// }

app.get('/location', (request, response) => {

  const query = request.query.data;
  
  // console.log(`look up test ${query} result ${lookUp(query)}`);

  client.query(`SELECT * FROM locations WHERE search_query=$1`, [query]).then(sqlResult => {
    //debugging, and logging result
    // console.log('sql results', sqlResult);

    if(sqlResult.rowCount > 0){

      console.log('I found stuff in the DB! :D')
      response.send(sqlResult.rows[0]);

    } else {

      const urlToVisit = `https://maps.googleapis.com/maps/api/geocode/json?address=${query}&key=${GEOCODE_API_KEY}`
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

        //Logging data into the SQL DB
        const sqlQueryInsert = `INSERT INTO locations 
        (search_query, formatted_query, latitude, longitude)
        VALUES
        ($1, $2, $3, $4);`;
        const valuesArray = [newLocation.search_query, newLocation.formatted_query, newLocation.latitude, newLocation.longitude];

        //client.query takes in a string and array and smooshes them into a proper sql statement that it sends to the db
        client.query(sqlQueryInsert, valuesArray);

        response.send(newLocation);
      }).catch(error => {
        response.status(500).send(error.message);
        console.error(error);
      })
    }
  })
})


function getWeather(request, response){

  const query = request.query.data;

  client.query(`SELECT * FROM weather WHERE search_query=$1`, [query]).then(sqlResult => {
    //debugging, and logging result
    // console.log('sql results', sqlResult);

    if(sqlResult.rowCount > 0){

      console.log('I found stuff in the DB! :D')
      response.send(sqlResult.rows[0]);

    } else {

      const urlToVisit = `https://api.darksky.net/forecast/${WEATHER_API_KEY}/${request.query.data.latitude},${request.query.data.longitude}`

      superagent.get(urlToVisit).then(responseFromSuper => {

        const weatherData = responseFromSuper.body;
        const eightDays = weatherData.daily.data;

        const formattedDays = eightDays.map(day => new Day(day.summary, day.time));

        response.send(formattedDays);

        //Logging data into the SQL DB
        formattedDays.forEach(day => {
          const sqlQueryInsert = `INSERT INTO weather 
          (search_query, forecast, time)
          VALUES
          ($1, $2, $3);`;
          const valuesArray = [query.search_query, day.forecast, day.time]
  
          //client.query takes in a string and array and smooshes them into a proper sql statement that it sends to the db
          client.query(sqlQueryInsert, valuesArray);
          
        })
      })
    }
  }).catch(error => {
    response.status(500).send(error.message);
    console.error(error);
  })
}

function getEvents(request, response) {
  const query = request.query.data;

  client.query(`SELECT * FROM events WHERE search_query=$1`, [query]).then(sqlResult => {
    //debugging, and logging result
    // console.log('sql results', sqlResult);

    if(sqlResult.rowCount > 0){

      console.log('I found stuff in the DB! :D')
      response.send(sqlResult.rows[0]);

    } else {

      const urlToVisit = `https://www.eventbriteapi.com/v3/events/search?location.longitude=${request.query.data.longitude}&location.latitude=${request.query.data.latitude}&token=${EVENTS_API_KEY}`;

      superagent.get(urlToVisit).then(responseFromSuper => {

        const eventData = responseFromSuper.body;

        const formattedEvent = eventData.events.map(event => new Eventbrite(event.url, event.name.text, event.start.local, event.summary));

        response.send(formattedEvent);

        //Logging data into the SQL DB
        formattedEvent.forEach(event => {
          const sqlQueryInsert = `INSERT INTO events 
          (search_query, link, name, event_date, summary)
          VALUES
          ($1, $2, $3, $4, $5);`;
          const valuesArray = [query.search_query, event.link, event.name, event.event_date, event.summary];
  
          //client.query takes in a string and array and smooshes them into a proper sql statement that it sends to the db
          client.query(sqlQueryInsert, valuesArray);
        })
      })
    }

  }).catch(error => {
    response.status(500).send(error.message);
    console.error(error);
  })
}

app.get('/weather', getWeather)
app.get('/events', getEvents)

app.listen(PORT, () => {console.log(`app is up on PORT ${PORT}`)});
