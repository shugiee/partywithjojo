"use strict";
// Countdown timer
const timerDays = document.getElementById("timer-days");
const timerHours = document.getElementById("timer-hours");
const timerMinutes = document.getElementById("timer-minutes");
const timerSeconds = document.getElementById("timer-seconds");
const weddingTime = new Date(Date.UTC(2025, 9, 25, 23, 0));
// Run once on mount
const daysTillWedding = (weddingTime.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
const daysRemaining = daysTillWedding - Math.floor(daysTillWedding);
const hoursTillWedding = daysRemaining * 24;
const hoursRemaining = hoursTillWedding - Math.floor(hoursTillWedding);
const minutesTillWedding = hoursRemaining * 60;
const minutesRemaining = minutesTillWedding - Math.floor(minutesTillWedding);
const secondsTillWedding = minutesRemaining * 60;
timerDays.innerHTML = Math.floor(daysTillWedding).toString();
timerHours.innerHTML = Math.floor(hoursTillWedding).toString();
timerMinutes.innerHTML = Math.floor(minutesTillWedding).toString();
timerSeconds.innerHTML = Math.floor(secondsTillWedding).toString();
// Keep running every second
setInterval(() => {
    const daysTillWedding = (weddingTime.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    const daysRemaining = daysTillWedding - Math.floor(daysTillWedding);
    const hoursTillWedding = daysRemaining * 24;
    const hoursRemaining = hoursTillWedding - Math.floor(hoursTillWedding);
    const minutesTillWedding = hoursRemaining * 60;
    const minutesRemaining = minutesTillWedding - Math.floor(minutesTillWedding);
    const secondsTillWedding = minutesRemaining * 60;
    timerDays.innerHTML = Math.floor(daysTillWedding).toString();
    timerHours.innerHTML = Math.floor(hoursTillWedding).toString();
    timerMinutes.innerHTML = Math.floor(minutesTillWedding).toString();
    timerSeconds.innerHTML = Math.floor(secondsTillWedding).toString();
}, 1000);
