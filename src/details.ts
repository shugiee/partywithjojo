interface Artist {
  name: string;
}

interface AlbumImage {
  height: number;
  width: number;
  url: string;
}

interface Song {
  id: string;
  name: string;
  artists: Artist[];
  album: {
    images: AlbumImage[];
  };
}

interface SearchResults {
  tracks: {
    items: Song[];
  };
}

interface PlaylistItems {
  items: { track: Song }[];
}

const songIds = new Set<string>();

const getCookie = (name: string) => {
  return (
    Object.fromEntries(
      document.cookie.split("; ").map((cookie) => cookie.split("=")),
    )[name] || null
  );
};

const getPlaylistItems = async () => {
  const playlistId = "4Prc1zbrD2taosqI5usgcy";
  const spotifyToken = getCookie("spotify");
  const playlistItemsResponse = await fetch(
    `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=50&fields=items(track(name,artists,album,id))`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${spotifyToken}`,
      },
    },
  );

  const items = (await playlistItemsResponse.json()) as PlaylistItems;

  if (!playlistItemsResponse.ok) {
    throw new Error(`Response status: ${playlistItemsResponse.status}`);
  } else {
    return items;
  }
};

const showSongAddedConfirmation = (id: string) => {
  const button = document.getElementById(
    `song-button-${id}`,
  ) as HTMLButtonElement;
  button.setAttribute("style", "cursor: auto; background: none");
  button.disabled = true;
  (
    document.getElementById(`${id}-added-indicator`) as HTMLDivElement
  ).setAttribute("style", "display: block");
};

const addToPlaylist = async (id: string) => {
  const isAlreadyInPlaylist = songIds.has(id);
  if (isAlreadyInPlaylist) {
  }
  const playlistId = "4Prc1zbrD2taosqI5usgcy";
  const spotifyToken = getCookie("spotify");
  const addToPlaylistResponse = await fetch(
    `https://api.spotify.com/v1/playlists/${playlistId}/tracks?uris=spotify:track:${id}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${spotifyToken}`,
        "Content-Type": "application/json",
      },
    },
  );

  if (!addToPlaylistResponse.ok) {
    throw new Error(
      `Failed to add song! Response status: ${addToPlaylistResponse.status}`,
    );
  } else {
    showSongAddedConfirmation(id);
    renderPlaylist({ scrollToBottom: true });
  }
};

const songRow = (idx: number, { id, name, artists, album }: Song) => `
<span class="spotify song-index">${idx}</span>
<img class="spotify-album-image" src="${album.images[0].url}"></img>
<span class="spotify-song-title-and-artists">
<div class="spotify spotify-song-title">${name}</div>
<div class="spotify spotify-artists-names">${artists.map(({ name }) => name).join(" ")}</div>
</span>
`;

const playlistItem = (idx: number, song: Song) => `
<div class="spotify-song-row">
${songRow(idx, song)}
</div>
`;

const songSearchResult = (idx: number, song: Song) => {
  const alreadyAdded = songIds.has(song.id);
  const elementType = alreadyAdded ? "div" : "button";
  const alreadyAddedIndicator = alreadyAdded
    ? `<span id="${song.id}-already-added-indicator" class="${songIds.has(song.id) ? "song-already-added-indicator" : ""}">Already added!</span>`
    : "";
  const onClick = alreadyAdded ? "" : `onclick="addToPlaylist('${song.id}')"`;
  return `
<${elementType} class="spotify-song-row" ${onClick} id="song-button-${song.id}">
${songRow(idx, song)}
<span id="${song.id}-added-indicator" class="song-added-indicator">Added!</span>
${alreadyAddedIndicator}
</${elementType}>
`;
};

const searchResults = (songs: Song[]) =>
  `<div class="spotify-songs-container">${songs.map((song, idx) => songSearchResult(idx, song)).join("")}</div>`;
const renderPlaylistItems = (songs: Song[]) =>
  `<div class="spotify-songs-container">${songs.map((song, idx) => playlistItem(idx, song)).join("")}</div>`;

const renderPlaylist = async ({
  scrollToBottom,
}: {
  scrollToBottom?: boolean;
} = {}) => {
  const playlistItems = getPlaylistItems();
  const playlistContainer = document.getElementById("spotify-playlist-items");
  const { items } = await playlistItems;
  const songs = items.map((item) => item.track);

  // Track songs in the playlist to prevent duplicates
  for (const song of songs) {
    songIds.add(song.id);
  }

  if (playlistContainer) {
    playlistContainer.innerHTML = renderPlaylistItems(songs);
    if (scrollToBottom) {
      console.log("SCROLLIN");
      const playlistItems = playlistContainer.getElementsByClassName(
        "spotify-songs-container",
      )[0];
      playlistItems.scrollTo({
        top: playlistItems.scrollHeight,
        behavior: "smooth",
      });
    }
  } else {
    throw new Error("Could not find playlist container");
  }
};
renderPlaylist();

const searchSpotify = async () => {
  const spotifyToken = getCookie("spotify");
  const text = (<HTMLInputElement>(
    document.getElementById("spotify-search-input")
  )).value;
  const params = new URLSearchParams();
  params.append("q", text);
  params.append("type", "track");
  const spotifyResponse = await fetch(
    `https://api.spotify.com/v1/search?${params}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${spotifyToken}`,
      },
    },
  );

  if (!spotifyResponse.ok) {
    throw new Error(`Response status: ${spotifyResponse.status}`);
  }

  const json = (await spotifyResponse.json()) as SearchResults;
  const searchResultsElement = document.getElementById(
    "spotify-search-results-container",
  );
  const songs = json.tracks.items.map((track) => {
    return track;
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
