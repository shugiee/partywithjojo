"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const getCookie = (name) => {
    return (Object.fromEntries(document.cookie.split("; ").map((cookie) => cookie.split("=")))[name] || null);
};
// TODO only get relevant fields from Spotify
const getPlaylistItems = () => __awaiter(void 0, void 0, void 0, function* () {
    const playlistId = "4Prc1zbrD2taosqI5usgcy";
    const spotifyToken = getCookie("spotify");
    const playlistItemsResponse = yield fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=50&fields=items(track(name,artists,album))`, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${spotifyToken}`,
        },
    });
    const items = (yield playlistItemsResponse.json());
    if (!playlistItemsResponse.ok) {
        throw new Error(`Response status: ${playlistItemsResponse.status}`);
    }
    else {
        return items;
    }
});
const addToPlaylist = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const playlistId = "4Prc1zbrD2taosqI5usgcy";
    const spotifyToken = getCookie("spotify");
    const addToPlaylistResponse = yield fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks?uris=spotify:track:${id}`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${spotifyToken}`,
            "Content-Type": "application/json",
        },
    });
    if (!addToPlaylistResponse.ok) {
        throw new Error(`Response status: ${addToPlaylistResponse.status}`);
    }
    else {
        console.log(`Added id ${id} to playlist!`);
    }
});
const playlistItem = ({ id, name, artists }) => `
<div class="playlist-item">
<div class="spotify song-name">${name}</div>
<div class="spotify artists">${artists.map((artist) => artist.name).join(" ")}</div>
</div>
`;
const songSearchResult = (idx, { id, name, artists, album }) => `
<button class="spotify-search-result">
<span class="spotify song-index">${idx}</span>
<img class="spotify-album-image" src="${album.images[0].url}"></img>
<span class="spotify-song-title-and-artists">
<div class="spotify spotify-song-title">${name}</div>
<div class="spotify spotify-artists-names">${artists.map(({ name }) => name).join(" ")}</div>
</span>
</button>
`;
const searchResults = (songs) => `<div id="spotify-search-results">${songs.map((song, idx) => songSearchResult(idx, song)).join("")}</div>`;
const renderPlaylistItems = (songs) => {
    console.log("songs", songs);
    return `<div id="playlist-items">${songs.map((song) => playlistItem(song)).join("")}</div>`;
};
const renderPlaylist = () => __awaiter(void 0, void 0, void 0, function* () {
    const playlistItems = getPlaylistItems();
    const playlistContainer = document.getElementById("spotify-playlist-items");
    const { items } = yield playlistItems;
    const songs = items.map((item) => item.track);
    if (playlistContainer) {
        playlistContainer.innerHTML = renderPlaylistItems(songs);
    }
    else {
        throw new Error("Could not find playlist container");
    }
});
renderPlaylist();
const searchSpotify = () => __awaiter(void 0, void 0, void 0, function* () {
    const spotifyToken = getCookie("spotify");
    const text = document.getElementById("spotify-search")
        .value;
    const params = new URLSearchParams();
    params.append("q", text);
    params.append("type", "track");
    const spotifyResponse = yield fetch(`https://api.spotify.com/v1/search?${params}`, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${spotifyToken}`,
        },
    });
    if (!spotifyResponse.ok) {
        throw new Error(`Response status: ${spotifyResponse.status}`);
    }
    const json = (yield spotifyResponse.json());
    const searchResultsElement = document.getElementById("spotify-search-results-container");
    const songs = json.tracks.items.map((track) => {
        return track;
    });
    if (searchResultsElement) {
        searchResultsElement.innerHTML = searchResults(songs);
    }
    else {
        throw new Error("Could not find search results element");
    }
});
const searchSubmitButton = document.getElementById("spotify-search-submit");
if (searchSubmitButton) {
    searchSubmitButton.addEventListener("click", searchSpotify);
}
else {
    throw new Error("Could not find search submit button");
}
