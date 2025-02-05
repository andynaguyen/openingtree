import React from "react";
import { createSubObjectWithProperties } from "../../app/util";
import * as Constants from "../../app/Constants";
import Source from "./Source";
import User from "./User";
import Filters from "./Filters";
import Actions from "./Actions";
import Variants from "./Variants";
import request from "request";
import * as SitePolicy from "../../app/SitePolicy";
import cookieManager from "../../app/CookieManager";

export default class PGNLoader extends React.Component {
  constructor(props) {
    super(props);
    const queryParams = new URLSearchParams(window.location.search);
    const selectedSite = queryParams.get("source");
    const selectedUsername = queryParams.get("username");

    const getExpandedPanel = () => {
      switch (true) {
        case selectedSite != null && selectedUsername != null:
          return "filters";
        case selectedSite != null:
          return "user";
        default:
          return "source";
      }
    };

    this.state = {
      profilePicUrl: null,
      playerExists: null,
      playerName: selectedUsername ?? "",
      site: selectedSite ? selectedSite : "",
      playerColor: this.props.settings.playerColor,
      isAdvancedFiltersOpen: false,
      isGamesSubsectionOpen: false,
      expandedPanel: getExpandedPanel(),
      notablePlayers: null,
      notableEvents: null,
      files: [],
      selectedNotableEvent: {},
      selectedNotablePlayer: {},
      lichessLoginState: Constants.LICHESS_NOT_LOGGED_IN,
      lichessLoginName: null,
      [Constants.FILTER_NAME_DOWNLOAD_LIMIT]: Constants.MAX_DOWNLOAD_LIMIT,
      [Constants.TIME_CONTROL_ULTRA_BULLET]: true,
      [Constants.TIME_CONTROL_BLITZ]: true,
      [Constants.TIME_CONTROL_RAPID]: true,
      [Constants.TIME_CONTROL_CLASSICAL]: true,
      [Constants.TIME_CONTROL_CORRESPONDENCE]: true,
      [Constants.TIME_CONTROL_DAILY]: true,
      [Constants.FILTER_NAME_RATED]: "all",
      [Constants.FILTER_NAME_ELO_RANGE]: [0, Constants.MAX_ELO_RATING],
      [Constants.FILTER_NAME_OPPONENT]: "",
      [Constants.TIME_CONTROL_BULLET]: true,
    };
    if (selectedSite === Constants.SITE_LICHESS) {
      this.fetchLichessLoginStatus();
    }
    this.fetchProfileData();
  }

  advancedFilters() {
    return createSubObjectWithProperties(this.state, [
      Constants.TIME_CONTROL_ULTRA_BULLET,
      Constants.TIME_CONTROL_BULLET,
      Constants.TIME_CONTROL_BLITZ,
      Constants.TIME_CONTROL_RAPID,
      Constants.TIME_CONTROL_CORRESPONDENCE,
      Constants.TIME_CONTROL_DAILY,
      Constants.TIME_CONTROL_CLASSICAL,
      Constants.FILTER_NAME_RATED,
      Constants.FILTER_NAME_DOWNLOAD_LIMIT,
      Constants.FILTER_NAME_ELO_RANGE,
      Constants.FILTER_NAME_OPPONENT,
      Constants.FILTER_NAME_FROM_DATE,
      Constants.FILTER_NAME_TO_DATE,
    ]);
  }

  handleExpansionChange(panel) {
    return (event, newExpanded) => {
      this.setState({ expandedPanel: newExpanded ? panel : false });
    };
  }

  exportOpeningTreeObject() {
    return {
      header: {
        version: 2, // current openingtree file version. used to check compatibility of files
        timestamp: Math.floor(Date.now() / 1000),
        gamesProcessed: this.props.gamesProcessed,
        settings: this.props.settings,
        playerName: this.state.playername,
        site: this.state.site,
        advancedFilters: this.advancedFilters(),
        variant: this.props.variant,
      },
      arrays: [
        [...this.props.openingGraph.graph.nodes.entries()],
        [...this.props.openingGraph.graph.pgnStats],
      ],
    };
  }

  importOpeningTreeObject(openingTreeSave) {
    let saveVersion = 1;
    if (openingTreeSave.header.version) {
      saveVersion = openingTreeSave.header.version;
    }
    if (saveVersion < Constants.OPENING_TREE_FILE_CURRENT_VERSION) {
      this.props.showError(
        "This is an old format of openingtree file.",
        null,
        "You can try loading it by visiting the old website",
        Constants.ERROR_ACTION_VISIT_OLD_SITE
      );
      return false;
    }
    this.setState({
      ...openingTreeSave.header.advancedFilters,
      playerColor: openingTreeSave.header.settings.playerColor,
      site: openingTreeSave.header.site,
      playerName: openingTreeSave.header.settings.playerName,
    });
    this.props.openingGraph.setEntries(
      openingTreeSave.arrays[0],
      openingTreeSave.arrays[1]
    );
    this.props.importCallback({
      settings: openingTreeSave.header.settings,
      gamesProcessed: openingTreeSave.header.gamesProcessed,
      openingGraph: this.props.openingGraph,
      variant: openingTreeSave.header.variant,
    });
    return true;
  }

  async playerDetailsChange(
    playerName,
    files,
    selectedNotableEvent,
    selectedNotablePlayer,
    selectedOnlineTournament
  ) {
    this.setState(
      {
        playerName: playerName,
        expandedPanel: SitePolicy.isFilterPanelEnabled(
          this.state.site,
          playerName,
          selectedNotablePlayer
        )
          ? "filters"
          : "",
        files: files,
        selectedNotableEvent: selectedNotableEvent,
        selectedNotablePlayer: selectedNotablePlayer,
        playerColor: "",
        selectedOnlineTournament: selectedOnlineTournament,
      },
      () => {
        this.fetchProfileData();
      }
    );
  }
  fetchGOATGames(url, callback) {
    request.get(url, (error, response) => {
      if (error) {
        this.props.showError(
          "Could not fetch player list. Failed to connect to DB."
        );
        callback([]);
        return;
      }
      let gamesDetails;
      try {
        gamesDetails = JSON.parse(response.body).list;
      } catch (e) {
        console.log(e);
      }
      if (!gamesDetails) {
        this.props.showError("Failed to load games.");
        callback([]);
      } else {
        callback(gamesDetails);
      }
    });
  }

  async fetchProfileData() {
    if (this.state.playerName === "") {
      return;
    }
    try {
      if (this.state.site === Constants.SITE_CHESS_DOT_COM) {
        const response = await fetch(
          `https://api.chess.com/pub/player/${this.state.playerName}`
        );
        if (response.ok) {
          const data = await response.json();
          this.setState({ profilePicUrl: data.avatar, playerExists: true });
        } else {
          this.setState({ playerExists: false });
        }
      } else if (this.state.site === Constants.SITE_LICHESS) {
        const response = await fetch(
          `https://lichess.org/api/user/${encodeURIComponent(
            this.state.playerName
          )}`
        );
        this.setState({ playerExists: response.ok });
      }
    } catch (e) {
      console.error(e);
      this.setState({ playerExists: false });
    }
  }

  siteChange(newSite) {
    if (newSite === Constants.SITE_PLAYER_DB && !this.state.notablePlayers) {
      this.fetchGOATGames(
        "https://goatchess.github.io/list.json",
        (gamesDetails) => {
          this.setState({ notablePlayers: gamesDetails });
        }
      );
    }
    if (newSite === Constants.SITE_EVENT_DB && !this.state.notableEvents) {
      this.fetchGOATGames(
        "https://goatevents.github.io/list.json",
        (gamesDetails) => {
          this.setState({ notableEvents: gamesDetails });
        }
      );
    }
    if (newSite === Constants.SITE_LICHESS) {
      this.fetchLichessLoginStatus();
    }

    this.setState({ site: newSite, expandedPanel: "user" });
  }
  fetchLichessLoginStatus() {
    let lichessAccessToken = cookieManager.getLichessAccessToken();
    if (lichessAccessToken) {
      this.setState({ lichessLoginState: Constants.LICHESS_STATE_PENDING });

      request.get(
        "https://lichess.org/api/account",
        {
          timeout: 5000,
          auth: { bearer: cookieManager.getLichessAccessToken() },
        },
        (error, response) => {
          if (!error && response) {
            let responseObj = JSON.parse(response.body);
            if (responseObj && responseObj.username) {
              this.setState({
                lichessLoginState: Constants.LICHESS_LOGGED_IN,
                lichessLoginName: responseObj.username,
              });
              return;
            }
          }
          this.setState({ lichessLoginState: Constants.LICHESS_FAILED_FETCH });
        }
      );
    }
  }
  logoutOfLichess() {
    cookieManager.deleteLichessAccessToken();
    this.setState({
      lichessLoginState: Constants.LICHESS_NOT_LOGGED_IN,
      lichessLoginName: "",
    });
  }

  filtersChange(filters) {
    this.setState({ ...filters, expandedPanel: "" });
  }
  variantChange(newVariant) {
    this.setState({ expandedPanel: "source" });
    this.props.variantChange(newVariant);
  }

  render() {
    return (
      <div>
        <div className="pgnloadersection">
          <Variants
            expandedPanel={this.state.expandedPanel}
            handleExpansionChange={this.handleExpansionChange("variant").bind(
              this
            )}
            variantChange={this.variantChange.bind(this)}
            variant={this.props.variant}
          />
          <Source
            expandedPanel={this.state.expandedPanel}
            handleExpansionChange={this.handleExpansionChange("source").bind(
              this
            )}
            site={this.state.site}
            siteChange={this.siteChange.bind(this)}
            variant={this.props.variant}
          />
          <User
            expandedPanel={this.state.expandedPanel}
            playerName={this.state.playerName}
            handleExpansionChange={this.handleExpansionChange("user").bind(
              this
            )}
            showError={this.props.showError}
            files={this.state.files}
            notablePlayers={this.state.notablePlayers}
            notableEvents={this.state.notableEvents}
            site={this.state.site}
            playerDetailsChange={this.playerDetailsChange.bind(this)}
            pgnUrl={this.state.pgnUrl}
            selectedPlayer={this.state.selectedNotablePlayer}
            selectedEvent={this.state.selectedNotableEvent}
            lichessLoginState={this.state.lichessLoginState}
            lichessLoginName={this.state.lichessLoginName}
            logoutOfLichess={this.logoutOfLichess.bind(this)}
            refreshLichessStatus={this.fetchLichessLoginStatus.bind(this)}
            selectedOnlineTournament={this.state.selectedOnlineTournament}
            oauthManager={this.props.oauthManager}
            profilePicUrl={this.state.profilePicUrl}
            playerExists={this.state.playerExists}
            variant={this.props.variant}
          />
          <Filters
            expandedPanel={this.state.expandedPanel}
            playerColor={this.state.playerColor}
            handleExpansionChange={this.handleExpansionChange("filters").bind(
              this
            )}
            site={this.state.site}
            playerName={this.state.playerName}
            advancedFilters={this.advancedFilters()}
            filtersChange={this.filtersChange.bind(this)}
            selectedNotablePlayer={this.state.selectedNotablePlayer}
          />
        </div>
        <Actions
          expandedPanel={this.state.expandedPanel}
          playerColor={this.state.playerColor}
          files={this.state.files}
          playerName={this.state.playerName}
          site={this.state.site}
          advancedFilters={this.advancedFilters()}
          notify={this.props.notify}
          showError={this.props.showError}
          onChange={this.props.onChange}
          setDownloading={this.props.setDownloading}
          clear={this.props.clear}
          isDownloading={this.props.isDownloading}
          switchToMovesTab={this.props.switchToMovesTab}
          gamesProcessed={this.props.gamesProcessed}
          selectedNotablePlayer={this.state.selectedNotablePlayer}
          selectedNotableEvent={this.state.selectedNotableEvent}
          exportOpeningTreeObject={this.exportOpeningTreeObject.bind(this)}
          showInfo={this.props.showInfo}
          importOpeningTreeObject={this.importOpeningTreeObject.bind(this)}
          selectedOnlineTournament={this.state.selectedOnlineTournament}
          variant={this.props.variant}
        />
      </div>
    );
  }
}
