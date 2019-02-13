#!/usr/bin/env node

'use strict'
var fs = require('fs')
var os = require('os')
var sprintf = require('sprintf-js').sprintf
var vsprintf = require('sprintf-js').vsprintf
var program = require('commander')
var moment = require('moment')
var colors = require('colors')
var touch = require("touch")
var path = require('path');
var {TimeFile, TimeEntry} = require('./timefile')

var monthsShort = moment.monthsShort()
var months = moment.months()
var days = moment.weekdaysShort()
var timeFile, dB
var categoryIn = ""

// Configure as desired
var backupDir = os.homedir() + "/.timeclock/";
var wage = process.env.TIMECLOCK_WAGE || 0

if (!fs.existsSync(backupDir)) {
	fs.mkdirSync(backupDir)
}

program
	.usage('[options]')
	.option('-f,  --file [file]', 'The file to use for the database')
  .option('-s, --summary-report', 'Print the summary report')
  .option('-d, --day-category-report', 'Print the current week category report')
  .option('-w, --week-category-report', 'Print the weekly category report')
  .option('-m, --month-category-report', 'Print the monthly category report')
  .option('-y, --year-category-report', 'Print the yearly category report')
  .option('-i  --in', 'Clock in')
  .option('-o  --out', 'Clock out')
	.option('-c  --category [category]','Use this category when clocking out')
	.option('-u  --current', 'Display the current (open) entry')
	.parse(process.argv)

if (program.file) {
	timeFile = program.file
}
else if (process.env.TIMECLOCK_FILE) {
	timeFile = process.env.TIMECLOCK_FILE
}

if (!timeFile) {
	console.log('No filename passed and TIMECLOCK_FILE is not set in the environment')
	process.exit(-1)
}

if (program.category) {
	categoryIn = program.category
}

// backup the file for now, create it if it doesn't exist
if (fs.existsSync(timeFile)) {
	var filename = sprintf("%s-%s",path.basename(timeFile),new Date().getTime())
	fs.createReadStream(timeFile).pipe(fs.createWriteStream(backupDir + filename))
}
else {
	touch(timeFile)
}

dB = new TimeFile(timeFile)

if (program.in) {
	clock_in()
}
else if (program.out) {
	clock_out()
}	
else if (program.summaryReport) {
	summary_report()
}
else if (program.dayCategoryReport) {
	daily_category_report()
}
else if (program.weekCategoryReport) {
	week_category_report()
}
else if (program.monthCategoryReport) {
	month_category_report()
}
else if (program.yearCategoryReport) {
	year_category_report()
}
else if (program.current) {
	current_report()
}
else {
	summary_report()
}


function output(str) {
	process.stdout.write(str)
}

function format_interval(title,hours) {
	return sprintf('%s\t %6.2f %8.2f',title,hours,hours*wage)
}

function current_report() {
	let a = dB.parse()
	output(format_interval('current',a[a.length-1].hours)+'\n')
}

function summary_report() {

	let groupByDay = dB.groupByDay()
	let month_hours = {}
	let total_hours = 0
	let weeks = {}

	output('\nSummary Report\n\n')
	
	for (var i=0; i<groupByDay.length; i++) {

		let entry = groupByDay[i]
		
		let key = sprintf('%dW%02d',entry.date.getYear()+1900, moment(entry.date).week())

		total_hours += entry.hours

		if (!weeks[key]) {
			weeks[key] = []
		}
		weeks[key].push(entry)
	}

	output(vsprintf('%12s %5s %5s %5s %5s %5s %5s',days))
	output(sprintf('%8s %8s\n','Total','Wage'))

	for (let week_number in weeks) {

		let daysInWeek = weeks[week_number]
		let sunday = moment(week_number).startOf('week').toDate()

		output(sprintf('%s %02d',monthsShort[sunday.getMonth()],sunday.getDate()))
		
		days.forEach( day => {

			let entry = daysInWeek.find( i => i.dayOfWeek === day)
			
			if (entry) {
				output(sprintf(' %5.2f',entry.hours))

				if (!month_hours[entry.date.getMonth()]) {
					month_hours[entry.date.getMonth()] = entry.hours
				}
				else {
					month_hours[entry.date.getMonth()] += entry.hours
				}

			}
			else {
				output(sprintf(' %5s','-'))
			}
			
		})
		
		
		let total_week_hours = daysInWeek.map( i => i.hours).reduce( (a,v) => a + v)
		let gross = total_week_hours * wage

		output(sprintf('%8.2f %8.2f',total_week_hours, gross))
		output('\n')
	}

	output('\n')
	for (let month in month_hours) {
		let month_gross = month_hours[month] * wage
		output(sprintf('%-11s %7.2f %8.2f\n',
									 months[month],month_hours[month], month_gross))
	}

  let total_gross = total_hours * wage
	output(sprintf('%-11s %7.2f %8.2f\n',
                 'Grand Total',total_hours,total_gross).green)
}

function daily_category_report() {
	let year = ""
	let group = dB.currentWeekGroupByDayAndCategory()

	output("Current Week\n\n")
	Object.keys(group).forEach( week_day => {

		output(sprintf('%s\n',week_day))
		Object.keys(group[week_day]).forEach( item => {
			output(sprintf('%5.2fh %s \n',group[week_day][item],item))
		})
		output("\n")
	})
}

function week_category_report() {
	let year = ""
	let group = dB.groupByWeekAndCategory()

	Object.keys(group).forEach( week_number => {

		let sunday = moment(week_number).startOf('week').toDate()
		let saturday = moment(week_number).endOf('week').toDate()

		if (sunday.getYear() != year) {
			year = sunday.getYear()
			output(sprintf('%s\n',year+1900))
		}

		output(sprintf('%s-%02d thru %s-%02d\n',
									 monthsShort[sunday.getMonth()],sunday.getDate(),
									 monthsShort[saturday.getMonth()],saturday.getDate()))

		Object.keys(group[week_number]).forEach( item => {
			output(sprintf('%5.2fh %s \n',group[week_number][item],item))
		})
		output("\n")
	})

}

function month_category_report() {
	let group = dB.groupByMonthAndCategory()
	Object.keys(group).forEach( month => {
		output(sprintf('\n%s\n',month))
		Object.keys(group[month]).forEach( item => {
			output(sprintf('%6.2f %s\n',group[month][item],item))
		})
		output("\n")
	})
}

function year_category_report() {
	let group = dB.groupByYearAndCategory()
	Object.keys(group).forEach( year => {
		output(sprintf('\n%d\n',year))
		Object.keys(group[year]).forEach( item => {
			output(sprintf('%7.2f %s \n',group[year][item],item))
		})
		output("\n")
	})
}

function clock_in() {
	console.log('clocking in')

	if (dB.currentEntry()) {
		console.log('current entry exists, clock out first!')
		return
	}

	dB.openEntry()
}

function clock_out() {
	console.log('clocking out')

	if (!dB.currentEntry()) {
		console.log('no current entry exists, clock in first!')
		return
	}

	if (dB.currentEntry().date.getDate() !== new Date().getDate()) {
		console.log('timeclock can\'t process entries which span multiple days')
		return
	}
	dB.closeEntry(categoryIn)
}
