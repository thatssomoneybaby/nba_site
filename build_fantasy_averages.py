# build_fantasy_averages.py
import time, json, math
import pandas as pd
from nba_api.stats.endpoints.leaguedashplayerstats import LeagueDashPlayerStats
from nba_api.stats.endpoints.commonplayerinfo import CommonPlayerInfo

SEASON = "2024-25"              # target season
SEASON_TYPE = "Regular Season"  # change if you want Playoffs
STACK_TRIPLE_DOUBLE = True      # True = DD (7.5) + TD (+7.5 more) => 15 total

print("Fetching league per-game stats…")
df = LeagueDashPlayerStats(
    season=SEASON,
    season_type_all_star=SEASON_TYPE,
    per_mode_detailed="PerGame"
).get_data_frames()[0]

# Friendly column access with fallbacks
def col(name, default=0):
    return df[name] if name in df.columns else default

# Fantasy per-game from per-game stats + DD/TD bonus per game
dd2 = col("DD2", 0)   # # of double-doubles
td3 = col("TD3", 0)   # # of triple-doubles
gp  = col("GP", 1).replace(0, 1)  # avoid /0

bonus_per_game = ((dd2 * 7.5) + (td3 * (15 if STACK_TRIPLE_DOUBLE else 7.5))) / gp

df["FPTS"] = (
    col("PTS") +
    col("REB") * 1.5 +
    col("AST") * 1.5 +
    col("STL") * 3 +
    col("BLK") * 3 +
    col("FGM") * 1 +
    col("FTM") * 1 +
    col("FG3M") * 2 +
    col("FGA") * -0.2 +
    col("TOV") * -1.5 +
    bonus_per_game
)

# Try to use a position column from this endpoint; if missing, fill via CommonPlayerInfo
pos_col = "PLAYER_POSITION" if "PLAYER_POSITION" in df.columns else ("POSITION" if "POSITION" in df.columns else None)
if pos_col is None:
    print("Filling positions via CommonPlayerInfo (one call per player, please wait)…")
    positions = {}
    for pid in df["PLAYER_ID"].unique():
        try:
            info = CommonPlayerInfo(player_id=int(pid)).get_data_frames()[0]
            positions[pid] = info.loc[0, "POSITION"]
        except Exception:
            positions[pid] = None
        time.sleep(0.5)  # be polite to NBA site
    df["POSITION"] = df["PLAYER_ID"].map(positions)
else:
    df["POSITION"] = df[pos_col]

# Trim & rename
keep = [
    "PLAYER_ID","PLAYER_NAME","TEAM_ABBREVIATION","POSITION","GP","MIN",
    "PTS","REB","AST","STL","BLK","FGM","FGA","FG3M","FTM","TOV","FPTS"
]
df = df[keep].copy()
df.rename(columns={
    "PLAYER_ID":"player_id",
    "PLAYER_NAME":"player",
    "TEAM_ABBREVIATION":"team",
    "POSITION":"pos",
    "GP":"gp",
    "MIN":"min",
    "PTS":"pts","REB":"reb","AST":"ast","STL":"stl","BLK":"blk",
    "FGM":"fgm","FGA":"fga","FG3M":"fg3m","FTM":"ftm","TOV":"tov",
    "FPTS":"fpts"
}, inplace=True)

# Round nicely
for c in ["min","pts","reb","ast","stl","blk","fgm","fga","fg3m","ftm","tov","fpts"]:
    df[c] = df[c].astype(float).round(2)

# Sort by fantasy avg desc
df.sort_values("fpts", ascending=False, inplace=True, ignore_index=True)

# Save
df.to_csv("fantasy_averages_2024_25.csv", index=False)
with open("fantasy_averages_2024_25.json","w") as f:
    json.dump(df.to_dict(orient="records"), f)

print("✅ Wrote fantasy_averages_2024_25.csv and fantasy_averages_2024_25.json")