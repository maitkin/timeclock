'use strict'
var fs  = require("fs")
var sprintf = require("sprintf-js").sprintf
var moment = require('moment');
var Mon = moment.monthsShort()
var Days = moment.weekdaysShort()

function TimeEntry(index,month,mday,wday,category,raw) {
	this.index = index
	this.monthAndDay = month+" "+mday
	this.dayOfWeek = wday
	this.hours = 0
	this.date = {}
	this.isCurrent = false
	this.category = category
	this.week = {}
	this.year = {}
	this.month = {}
	this.yearAndMonth = {}
	this.raw = raw
}

class TimeFile {

	constructor(file) {
		this.file = file
	}

	// start a new time entry
	openEntry() {
		let date = new Date()
		fs.appendFileSync(this.file,
											sprintf("%s %s %02d %d  %02d:%02d-\n",
															Days[date.getDay()],
															Mon[date.getMonth()],
															date.getDate(),
															date.getYear()+1900,
															date.getHours(),
															date.getMinutes()))
	}


	closeEntry(category) {

		// read list first as the file will be overwritten
		let all = this.parse()
		
		var output = fs.createWriteStream(this.file)

		all.forEach( entry => {
			if (entry.isCurrent) {
				let date = new Date()
				output.write(sprintf("%s%02d:%02d %s\n",entry.raw,date.getHours(),date.getMinutes(),category))
			}
			else {
				output.write(entry.raw+"\n")
			}
		})
	}


	/*
		Create a new set of intervals consolidated by a single date.  Note: categories
		are invalid in this data set.  This needs to be refactored to model the other
		group functions...
	 */
	groupByDay() {
		let groupByDay = []
	
		this.parse().forEach( entry => {
			let index = groupByDay.findIndex( i => i.monthAndDay === entry.monthAndDay )
			if (index === -1) {
				groupByDay.push(entry)
			}
			else {
				let it = groupByDay[index]
				it.hours = it.hours + entry.hours
				it.isCurrent = it.isCurrent
				it.raw = "N/A"
				groupByDay[index] = it
			}
		})

		return groupByDay
	}


	currentWeekGroupByDayAndCategory() {

		let group = {}

		this.parse().forEach( entry => {

			let current_date = new Date()
			let current_week_string = sprintf('%dW%02d',current_date.getYear()+1900,moment(current_date).week())

			if (entry.week === current_week_string) {

				// create the first dayOfWeek object
				if (!group[entry.dayOfWeek]) {
					group[entry.dayOfWeek] =	{	[entry.category]: entry.hours }
				}
				else {
					// create the first category sub object
					if (!group[entry.dayOfWeek][entry.category]) {
						group[entry.dayOfWeek][entry.category] = entry.hours;
					}
					else {
						group[entry.dayOfWeek][entry.category] += entry.hours;
					}
				}
			}
		})
		return group
	}


	groupByWeekAndCategory() {

		let group = {}

		this.parse().forEach( entry => {

			// create the first week object
			if (!group[entry.week]) {
				group[entry.week] =	{	[entry.category]: entry.hours }
			}
			else {

				// create the first category sub object
				if (!group[entry.week][entry.category]) {
					group[entry.week][entry.category] = entry.hours;
				}
				else {
					group[entry.week][entry.category] += entry.hours;
				}
			}
		})

		return group
	}

	groupByMonthAndCategory() {

		let group = {}

		this.parse().forEach( entry => {

			// create the first month object
			if (!group[entry.yearAndMonth]) {
				group[entry.yearAndMonth] =	{	[entry.category]: entry.hours }
			}
			else {

				// create the first category sub object
				if (!group[entry.yearAndMonth][entry.category]) {
					group[entry.yearAndMonth][entry.category] = entry.hours;
				}
				else {
					group[entry.yearAndMonth][entry.category] += entry.hours;
				}
			}
		})

		return group
	}


	groupByYearAndCategory() {

		let group = {}

		this.parse().forEach( entry => {

			// create the first year object
			if (!group[entry.year]) {
				group[entry.year] =	{	[entry.category]: entry.hours }
			}
			else {

				// create the first category sub object
				if (!group[entry.year][entry.category]) {
					group[entry.year][entry.category] = entry.hours;
				}
				else {
					group[entry.year][entry.category] += entry.hours;
				}
			}
		})

		return group
	}


	currentEntry() {

		let current = this.parse().find( i => i.isCurrent === true)

		// find any other entries for current day and add to current total
		if (current) {
			this.parse().forEach( entry => {
				if (!entry.isCurrent &&
						entry.date.getDate() === current.date.getDate() &&
						entry.date.getMonth() === current.date.getMonth() &&
						entry.date.getYear() === current.date.getYear()) {
					current.hours += entry.hours
				}
			})
			return current
		}
		
		return undefined
	}

	
	parse() {

		let all = []

		// file may not exist yet (clocking in first time)
		if (!fs.existsSync(this.file)) { return }

		var lines = require('fs').readFileSync(this.file, 'utf-8')
				.split('\n').filter(Boolean);

		let index = 0;
		let line

		lines.forEach( (line) => {

			var comment = /^\#/
			var empty =  /^\s/
			var match = /\w\w\w \w\w\w \d\d \d\d\d\d  \d\d\:\d\d\-/

			if (line.match(comment) || line.match(empty) || line.length == 0) {
				return
			}

			if (!line.match(match)) {
				console.log('skipping suspicious line '+line)
				return
			}
			
			var [wday, month, mday, year, times, category] = line.split(/\s+/)
			var [start_time, end_time] = times.split('-')
			var [start_hour, start_min] = start_time.split(':')
			var [end_hour, end_min] = end_time.split(':')

			if (category === undefined || category === "") category = 'no-category'
			
			let entry = new TimeEntry(index++,month,mday,wday,category,line)

			entry.year = year
			entry.month = month
			entry.yearAndMonth = sprintf("%s-%s",year,month)

			var started = new Date(year, Mon.indexOf(month), mday, start_hour,
														 start_min,0,0)
			
			var ended;
			if (!end_time) {
				ended = new Date()
				entry.isCurrent = true
			}
			else {
				ended = new Date(year, Mon.indexOf(month), mday, end_hour,end_min,0,0)
				entry.isCurrent = false
			}

			entry.date = new Date(year, Mon.indexOf(month), mday,0,0,0,0)

			let week_string = sprintf('%dW%02d',entry.date.getYear()+1900, moment(entry.date).week())
			entry.week = week_string
			entry.hours = (ended.getTime() - started.getTime()) /1000/60/60
			all.push(entry)		
		})
		return (all)
	}


}

module.exports = {TimeFile, TimeEntry}
