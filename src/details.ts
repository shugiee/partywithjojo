interface Artist {
    name: string;
}

interface Song {
    id: string;
    name: string;
    artists: Artist[];
}

interface SearchResults {
    tracks: {
        items: Song[];
    }
}

interface PlaylistItems {
    items: { track: Song }[];
}


const getCookie = (name: string) => {
    return Object.fromEntries(
        document.cookie
        .split('; ')
        .map(cookie => cookie.split('='))
    )[name] || null;
};

// TODO only get relevant fields from Spotify
const getPlaylistItems = async () => {
    const playlistId = "4Prc1zbrD2taosqI5usgcy";
    const spotifyToken = getCookie("todoxcxc");
    const playlistItemsResponse = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=50&fields=items(track(name))`, {
        method: "GET",
    headers: {
        "Authorization": `Bearer ${spotifyToken}`,
    },
    });

    const items = await playlistItemsResponse.json() as PlaylistItems;

    if (!playlistItemsResponse.ok) {
        throw new Error(`Response status: ${playlistItemsResponse.status}`);
    } else {
        return items;
    }
};

const addToPlaylist = async (id: string) => {
    const playlistId = "4Prc1zbrD2taosqI5usgcy";
    const spotifyToken = getCookie("spotify");
    const addToPlaylistResponse = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks?uris=spotify:track:${id}`, {
        method: "POST",
    headers: {
        "Authorization": `Bearer ${spotifyToken}`,
        "Content-Type": "application/json",
    },
    });

    if (!addToPlaylistResponse.ok) {
        throw new Error(`Response status: ${addToPlaylistResponse.status}`);
    } else {
        console.log(`Added id ${id} to playlist!`);
    }
};

const playlistItem = ({ id, name, artists }: Song) => `
    <div class="playlist-item">
        <div class="song-name">${name}</div>
        <div class="artists">${artists.map(artist => artist.name).join(" ")}</div>
    </div>
`;

const songSearchResult = ({ id, name, artists }: Song) => `
    <div class="search-result-container">
        <button onclick="addToPlaylist('${id}')">
            <div class="song-name">${name}</div>
            <div class="artists">${artists.map(({ name }) => name).join(" ")}</div>
        </button>
    </div>
`;

const searchResults = (songs: Song[]) => `<div id="search-results">${songs.map(song => songSearchResult(song)).join("")}</div>`;
const renderPlaylistItems = (songs: Song[]) => `<div id="playlist-items">${songs.map(song => playlistItem(song)).join("")}</div>`;

const renderPlaylist = async () => {
    const playlistItems = getPlaylistItems();
    const playlistContainer = document.getElementById("spotify-playlist-items");
    const { items } = await playlistItems;
    const songs = items.map(({ track }) => {
        const { name, artists, id } = track;
        return { name, artists, id };
    });

    if (playlistContainer) {
        playlistContainer.innerHTML = renderPlaylistItems(songs);
    } else {
        throw new Error("Could not find playlist container");
    }
};
renderPlaylist();

const searchSpotify = async () => {
    const spotifyToken = getCookie("spotify");
    const text = (<HTMLInputElement>document.getElementById("spotify-search")).value;
    const params = new URLSearchParams();
    params.append("q", text);
    params.append("type", "track");
    const spotifyResponse = await fetch(`https://api.spotify.com/v1/search?${params}`, {
        method: "GET",
    headers: {
        "Authorization": `Bearer ${spotifyToken}`
    },
    });

    if (!spotifyResponse.ok) {
        throw new Error(`Response status: ${spotifyResponse.status}`);
    }

    const json = await spotifyResponse.json() as SearchResults;
    const searchResultsElement = document.getElementById("spotify-search-results");
    const songs = json.tracks.items.map(track => {
        const { name, artists, id } = track;
        return {name, artists, id};
    });
    if (searchResultsElement) {

    searchResultsElement.innerHTML = searchResults(songs);
    } else {
        throw new Error("Could not find search results element");
    }
};

const searchSubmitButton = document.getElementById("spotify-search-submit");
if (searchSubmitButton) {
    searchSubmitButton.addEventListener("click", searchSpotify);
} else {
    throw new Error("Could not find search submit button");
}

