(function () {
  "use strict";

  const RAW_TRACKS = [
    ["eagles-hotel-california", "Hotel California", "Eagles"],
    ["dire-straits-sultans-of-swing", "Sultans of Swing", "Dire Straits"],
    ["dire-straits-walk-of-life", "Walk of Life", "Dire Straits"],
    ["dire-straits-money-for-nothing", "Money for Nothing", "Dire Straits"],
    ["dire-straits-so-far-away", "So Far Away", "Dire Straits"],
    ["dire-straits-brothers-in-arms", "Brothers in Arms", "Dire Straits"],
    ["boston-more-than-a-feeling", "More Than a Feeling", "Boston"],
    ["boston-peace-of-mind", "Peace of Mind", "Boston"],
    ["journey-dont-stop-believin", "Don't Stop Believin'", "Journey"],
    ["journey-separate-ways-worlds-apart", "Separate Ways (Worlds Apart)", "Journey"],
    ["journey-any-way-you-want-it", "Any Way You Want It", "Journey"],
    ["toto-hold-the-line", "Hold the Line", "Toto"],
    ["toto-africa", "Africa", "Toto"],
    ["toto-rosanna", "Rosanna", "Toto"],
    ["foreigner-juke-box-hero", "Juke Box Hero", "Foreigner"],
    ["foreigner-waiting-for-a-girl-like-you", "Waiting for a Girl Like You", "Foreigner"],
    ["foreigner-i-want-to-know-what-love-is", "I Want to Know What Love Is", "Foreigner"],
    ["kansas-dust-in-the-wind", "Dust in the Wind", "Kansas"],
    ["kansas-carry-on-wayward-son", "Carry On Wayward Son", "Kansas"],
    ["reo-speedwagon-keep-on-loving-you", "Keep on Loving You", "REO Speedwagon"],
    ["fleetwood-mac-dreams", "Dreams", "Fleetwood Mac"],
    ["fleetwood-mac-go-your-own-way", "Go Your Own Way", "Fleetwood Mac"],
    ["fleetwood-mac-everywhere", "Everywhere", "Fleetwood Mac"],
    ["fleetwood-mac-little-lies", "Little Lies", "Fleetwood Mac"],
    ["supertramp-the-logical-song", "The Logical Song", "Supertramp"],
    ["supertramp-give-a-little-bit", "Give a Little Bit", "Supertramp"],
    ["supertramp-breakfast-in-america", "Breakfast in America", "Supertramp"],
    ["america-a-horse-with-no-name", "A Horse with No Name", "America"],
    ["america-sister-golden-hair", "Sister Golden Hair", "America"],
    ["america-ventura-highway", "Ventura Highway", "America"],
    ["bread-everything-i-own", "Everything I Own", "Bread"],
    ["bread-make-it-with-you", "Make It with You", "Bread"],
    ["gerry-rafferty-baker-street", "Baker Street", "Gerry Rafferty"],
    ["cat-stevens-wild-world", "Wild World", "Cat Stevens"],
    ["steve-miller-band-the-joker", "The Joker", "Steve Miller Band"],
    ["steve-miller-band-fly-like-an-eagle", "Fly Like an Eagle", "Steve Miller Band"],
    ["electric-light-orchestra-mr-blue-sky", "Mr. Blue Sky", "Electric Light Orchestra"],
    ["electric-light-orchestra-dont-bring-me-down", "Don't Bring Me Down", "Electric Light Orchestra"],
    ["electric-light-orchestra-last-train-to-london", "Last Train to London", "Electric Light Orchestra"],
    ["electric-light-orchestra-telephone-line", "Telephone Line", "Electric Light Orchestra"],
    ["creedence-clearwater-revival-have-you-ever-seen-the-rain", "Have You Ever Seen the Rain", "Creedence Clearwater Revival"],
    ["creedence-clearwater-revival-proud-mary", "Proud Mary", "Creedence Clearwater Revival"],
    ["creedence-clearwater-revival-down-on-the-corner", "Down on the Corner", "Creedence Clearwater Revival"],
    ["creedence-clearwater-revival-up-around-the-bend", "Up Around the Bend", "Creedence Clearwater Revival"],
    ["creedence-clearwater-revival-lookin-out-my-back-door", "Lookin' Out My Back Door", "Creedence Clearwater Revival"],
    ["lynyrd-skynyrd-sweet-home-alabama", "Sweet Home Alabama", "Lynyrd Skynyrd"],
    ["the-doobie-brothers-long-train-runnin", "Long Train Runnin'", "The Doobie Brothers"],
    ["the-doobie-brothers-listen-to-the-music", "Listen to the Music", "The Doobie Brothers"],
    ["the-doobie-brothers-what-a-fool-believes", "What a Fool Believes", "The Doobie Brothers"],
    ["steely-dan-reelin-in-the-years", "Reelin' in the Years", "Steely Dan"],
    ["queen-dont-stop-me-now", "Don't Stop Me Now", "Queen"],
    ["queen-crazy-little-thing-called-love", "Crazy Little Thing Called Love", "Queen"],
    ["queen-another-one-bites-the-dust", "Another One Bites the Dust", "Queen"],
    ["queen-under-pressure", "Under Pressure", "Queen"],
    ["queen-radio-ga-ga", "Radio Ga Ga", "Queen"],
    ["queen-i-want-to-break-free", "I Want to Break Free", "Queen"],
    ["queen-a-kind-of-magic", "A Kind of Magic", "Queen"],
    ["queen-youre-my-best-friend", "You're My Best Friend", "Queen"],
    ["simple-minds-dont-you-forget-about-me", "Don't You (Forget About Me)", "Simple Minds"],
    ["tears-for-fears-everybody-wants-to-rule-the-world", "Everybody Wants to Rule the World", "Tears for Fears"],
    ["tears-for-fears-head-over-heels", "Head Over Heels", "Tears for Fears"],
    ["a-ha-take-on-me", "Take on Me", "A-ha"],
    ["a-ha-the-sun-always-shines-on-tv", "The Sun Always Shines on T.V.", "A-ha"],
    ["the-cars-drive", "Drive", "The Cars"],
    ["the-cars-you-might-think", "You Might Think", "The Cars"],
    ["bryan-adams-summer-of-69", "Summer of '69", "Bryan Adams"],
    ["bryan-adams-run-to-you", "Run to You", "Bryan Adams"],
    ["bryan-adams-heaven", "Heaven", "Bryan Adams"],
    ["huey-lewis-and-the-news-the-power-of-love", "The Power of Love", "Huey Lewis and the News"],
    ["huey-lewis-and-the-news-stuck-with-you", "Stuck with You", "Huey Lewis and the News"],
    ["rick-springfield-jessies-girl", "Jessie's Girl", "Rick Springfield"],
    ["john-mellencamp-jack-and-diane", "Jack & Diane", "John Mellencamp"],
    ["john-mellencamp-hurts-so-good", "Hurts So Good", "John Mellencamp"],
    ["billy-idol-dancing-with-myself", "Dancing with Myself", "Billy Idol"],
    ["billy-idol-eyes-without-a-face", "Eyes Without a Face", "Billy Idol"],
    ["bon-jovi-you-give-love-a-bad-name", "You Give Love a Bad Name", "Bon Jovi"],
    ["bon-jovi-wanted-dead-or-alive", "Wanted Dead or Alive", "Bon Jovi"],
    ["bon-jovi-its-my-life", "It's My Life", "Bon Jovi"],
    ["bon-jovi-always", "Always", "Bon Jovi"],
    ["aerosmith-dream-on", "Dream On", "Aerosmith"],
    ["aerosmith-i-dont-want-to-miss-a-thing", "I Don't Want to Miss a Thing", "Aerosmith"],
    ["aerosmith-crazy", "Crazy", "Aerosmith"],
    ["van-halen-jump", "Jump", "Van Halen"],
    ["van-halen-why-cant-this-be-love", "Why Can't This Be Love", "Van Halen"],
    ["heart-barracuda", "Barracuda", "Heart"],
    ["heart-alone", "Alone", "Heart"],
    ["joan-jett-and-the-blackhearts-i-love-rock-n-roll", "I Love Rock 'n Roll", "Joan Jett & the Blackhearts"],
    ["pat-benatar-hit-me-with-your-best-shot", "Hit Me with Your Best Shot", "Pat Benatar"],
    ["the-police-every-breath-you-take", "Every Breath You Take", "The Police"],
    ["the-police-message-in-a-bottle", "Message in a Bottle", "The Police"],
    ["the-police-every-little-thing-she-does-is-magic", "Every Little Thing She Does Is Magic", "The Police"],
    ["u2-with-or-without-you", "With or Without You", "U2"],
    ["u2-beautiful-day", "Beautiful Day", "U2"],
    ["u2-where-the-streets-have-no-name", "Where the Streets Have No Name", "U2"],
    ["rem-man-on-the-moon", "Man on the Moon", "R.E.M."],
    ["rem-the-one-i-love", "The One I Love", "R.E.M."],
    ["the-cranberries-dreams", "Dreams", "The Cranberries"],
    ["the-cranberries-linger", "Linger", "The Cranberries"],
    ["the-cure-friday-im-in-love", "Friday I'm in Love", "The Cure"],
    ["tom-petty-i-wont-back-down", "I Won't Back Down", "Tom Petty"]
  ];

  const EXTRA_ALIASES = {
    "dire-straits-sultans-of-swing": ["sultan of swing", "dire straits sultans", "sultans swing"],
    "eagles-hotel-california": ["eagles hotel california"],
    "creedence-clearwater-revival-have-you-ever-seen-the-rain": ["creedence rain", "ccr have you ever seen the rain", "have you ever seen rain"],
    "boston-more-than-a-feeling": ["more than feeling", "boston more than feeling"],
    "journey-dont-stop-believin": ["dont stop believing", "journey dont stop believing"],
    "fleetwood-mac-dreams": ["dreams fleetwood mac"],
    "the-cranberries-dreams": ["dreams cranberries", "cranberries dreams"],
    "electric-light-orchestra-mr-blue-sky": ["elo mr blue sky", "mr blue sky"],
    "electric-light-orchestra-dont-bring-me-down": ["elo dont bring me down"],
    "electric-light-orchestra-last-train-to-london": ["elo last train to london"],
    "electric-light-orchestra-telephone-line": ["elo telephone line"],
    "creedence-clearwater-revival-proud-mary": ["ccr proud mary"],
    "creedence-clearwater-revival-down-on-the-corner": ["ccr down on the corner"],
    "creedence-clearwater-revival-up-around-the-bend": ["ccr up around the bend"],
    "creedence-clearwater-revival-lookin-out-my-back-door": ["ccr lookin out my back door"],
    "queen-dont-stop-me-now": ["dont stop me now queen"],
    "a-ha-take-on-me": ["take on me aha", "aha take on me"],
    "bryan-adams-summer-of-69": ["summer 69", "summer of 69"],
    "joan-jett-and-the-blackhearts-i-love-rock-n-roll": ["i love rock and roll", "i love rock n roll"],
    "rem-man-on-the-moon": ["r e m man on the moon", "rem man on the moon"],
    "rem-the-one-i-love": ["r e m the one i love", "rem the one i love"],
    "the-cure-friday-im-in-love": ["friday im in love", "friday i am in love"]
  };

  function clean(value) {
    return String(value || "").replace(/[\u0000-\u001f<>]/g, "").trim();
  }

  function normalize(value) {
    return clean(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\b(?:elo|toque|toca|tocar|coloque|coloca|colocar|poe|ponha|bota|botar|reproduza|reproduzir|play|musica|som|uma|um|a|o)\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function uniqueNormalizedAliases(values) {
    const seen = {};
    return values.map(normalize).filter(function (value) {
      if (!value || seen[value]) return false;
      seen[value] = true;
      return true;
    });
  }

  function buildAliases(id, title, artist) {
    const normalizedTitle = normalize(title);
    const normalizedArtist = normalize(artist);
    const artistShort = normalizedArtist.replace(/^the\s+/, "").split(" ").slice(0, 2).join(" ");
    return uniqueNormalizedAliases([
      normalizedTitle,
      normalizedArtist + " " + normalizedTitle,
      artistShort + " " + normalizedTitle,
      normalizedTitle.replace(/^the\s+/, ""),
      normalizedTitle.split(" ").filter(function (token) { return !/^(the|and|with|for|to|in|of|on)$/.test(token); }).join(" ")
    ].concat(EXTRA_ALIASES[id] || []));
  }

  const VALIDATED_VIDEO_METADATA = {
      "eagles-hotel-california": {
          "videoId": "09839DpTctU",
          "resolvedTitle": "Eagles - Hotel California (Live 1977) (Official Video) [HD]",
          "channel": "Eagles",
          "source": "youtube-iframe-physical",
          "lastValidatedAt": "2026-08-26T03:39:15.563Z",
          "validationStatus": "REJECTED_PHYSICAL",
          "playConfirmed": false,
          "physicalValidation": {
              "method": "youtube_iframe_api_http_origin",
              "status": "REJECTED_IFRAME_ERROR",
              "error": "youtube_error_150",
              "testedCandidateIds": ["09839DpTctU","dLl4PZtxia8","5wDfiCDoHy4","hrOtR1hyRog"]
          }
      },
      "dire-straits-sultans-of-swing": {
          "videoId": "eqxpQA5etd4",
          "resolvedTitle": "Dire Straits - Sultans Of Swing (Live at Wembley 1985)",
          "channel": "Dire Straits",
          "source": "youtube-iframe-physical",
          "lastValidatedAt": "2026-08-31T23:40:02.858Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": true,
          "physicalValidation": {
              "method": "youtube_iframe_api_http_origin",
              "status": "PLAY_CONFIRMED",
              "error": null,
              "testedCandidateIds": ["h0ffIJ7ZO4U","UGB-ALSwNGQ","8Pa9x9fZBtY","0fAQhSRLQnM","MMFSLGq1wrQ","89Qg_gYqkys","kIufLA7Bx2Q","eqxpQA5etd4","95ywPJ_8hV4","jJa4pPH81_k"]
          }
      },
      "dire-straits-walk-of-life": {
          "videoId": "kd9TlGDZGkI",
          "resolvedTitle": "Dire Straits - Walk Of Life (Official Music Video)",
          "channel": "DireStraitsVEVO",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      },
      "dire-straits-money-for-nothing": {
          "videoId": "J7LzNrdrleQ",
          "resolvedTitle": "'Money For Nothing' (Live at Wembley 1985) @direstraitsofficial  #moneyfornothing",
          "channel": "Dire Straits",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      },
      "dire-straits-so-far-away": {
          "videoId": "s1AYy2Tls2s",
          "resolvedTitle": "'So Far Away (Official Music Video)' @direstraitsofficial",
          "channel": "Dire Straits",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      },
      "dire-straits-brothers-in-arms": {
          "videoId": "jhdFe3evXpk",
          "resolvedTitle": "Dire Straits - Brothers In Arms (Official Music Video)",
          "channel": "DireStraitsVEVO",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      },
      "boston-more-than-a-feeling": {
          "videoId": "t4QK8RxCAwo",
          "resolvedTitle": "Boston - More Than a Feeling (Official HD Video)",
          "channel": "BostonVEVO",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      },
      "boston-peace-of-mind": {
          "videoId": "edwk-8KJ1Js",
          "resolvedTitle": "Boston - Peace of Mind (Official Audio)",
          "channel": "BostonVEVO",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      },
      "journey-dont-stop-believin": {
          "videoId": "1k8craCGpgs",
          "resolvedTitle": "Journey - Don't Stop Believin' (Official Audio)",
          "channel": "journeyVEVO",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      },
      "journey-separate-ways-worlds-apart": {
          "videoId": "LatorN4P9aA",
          "resolvedTitle": "Journey - Separate Ways (Worlds Apart) (Official HD Video - 1983)",
          "channel": "journeyVEVO",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      },
      "journey-any-way-you-want-it": {
          "videoId": "atxUuldUcfI",
          "resolvedTitle": "Journey - Any Way You Want It (Official HD Video - 1980)",
          "channel": "journeyVEVO",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      },
      "toto-hold-the-line": {
          "videoId": "htgr3pvBr-I",
          "resolvedTitle": "Toto - Hold The Line (Official Video)",
          "channel": "TotoVEVO",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      },
      "toto-africa": {
          "videoId": "FTQbiNvZqaY",
          "resolvedTitle": "Toto - Africa (Official HD Video)",
          "channel": "TotoVEVO",
          "source": "youtube-iframe-physical",
          "lastValidatedAt": "2026-08-26T03:39:15.563Z",
          "validationStatus": "REJECTED_PHYSICAL",
          "playConfirmed": false,
          "physicalValidation": {
              "method": "youtube_iframe_api_http_origin",
              "status": "REJECTED_IFRAME_ERROR",
              "error": "youtube_error_150",
              "testedCandidateIds": ["FTQbiNvZqaY","Kb7lAMjFuA0","uhwLOBFc298","U1LB_OerHCE"]
          }
      },
      "toto-rosanna": {
          "videoId": "qmOLtTGvsbM",
          "resolvedTitle": "Toto - Rosanna (Official HD Video)",
          "channel": "TotoVEVO",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      },
      "foreigner-juke-box-hero": {
          "videoId": "BJ3hzwCeWi8",
          "resolvedTitle": "Enjoy the “Juke Box Hero” official music video now remastered in higher definition.",
          "channel": "Foreigner",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      },
      "foreigner-waiting-for-a-girl-like-you": {
          "videoId": "CCOEYgMQjCI",
          "resolvedTitle": "Foreigner - Waiting for a Girl Like You",
          "channel": "ForeignerVEVO",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      },
      "foreigner-i-want-to-know-what-love-is": {
          "videoId": "oe-bhvLJNjc",
          "resolvedTitle": "Foreigner - I Want To Know What Love Is (Live From Ellis Island) (Official Music Video)",
          "channel": "ForeignerVEVO",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      },
      "kansas-dust-in-the-wind": {
          "videoId": "tH2w6Oxx0kQ",
          "resolvedTitle": "Kansas - Dust in the Wind (Official Video)",
          "channel": "kansasVEVO",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      },
      "kansas-carry-on-wayward-son": {
          "videoId": "P5ZJui3aPoQ",
          "resolvedTitle": "Kansas - Carry on Wayward Son (Official Video)",
          "channel": "kansasVEVO",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      },
      "reo-speedwagon-keep-on-loving-you": {
          "videoId": "u-L_sGRyQHY",
          "resolvedTitle": "Keep on Loving You",
          "channel": "REO Speedwagon - Topic",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      },
      "fleetwood-mac-dreams": {
          "videoId": "Y3ywicffOj4",
          "resolvedTitle": "Fleetwood Mac - Dreams (Official Music Video) [4K]",
          "channel": "Fleetwood Mac",
          "source": "youtube-iframe-physical",
          "lastValidatedAt": "2026-08-26T03:39:15.563Z",
          "validationStatus": "REJECTED_PHYSICAL",
          "playConfirmed": false,
          "physicalValidation": {
              "method": "youtube_iframe_api_http_origin",
              "status": "REJECTED_IFRAME_ERROR",
              "error": "youtube_error_150",
              "testedCandidateIds": ["Y3ywicffOj4","5oWyMakvQew","O5ugW4-BstE","PgagPdVM7bk"]
          }
      },
      "fleetwood-mac-go-your-own-way": {
          "videoId": "ozl3L9fhKtE",
          "resolvedTitle": "Fleetwood Mac - Go Your Own Way (Official Music Video) [HD]",
          "channel": "Fleetwood Mac",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      },
      "fleetwood-mac-everywhere": {
          "videoId": "YF1R0hc5Q2I",
          "resolvedTitle": "Fleetwood Mac - Everywhere (Official Music Video) [HD]",
          "channel": "Fleetwood Mac",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      },
      "fleetwood-mac-little-lies": {
          "videoId": "uCGD9dT12C0",
          "resolvedTitle": "Fleetwood Mac - Little Lies (Official Music Video) [HD]",
          "channel": "Fleetwood Mac",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      },
      "supertramp-the-logical-song": {
          "videoId": "kln_bIndDJg",
          "resolvedTitle": "Supertramp - The Logical Song (Official Video)",
          "channel": "Supertramp ",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      },
      "supertramp-give-a-little-bit": {
          "videoId": "xfFUg_wb31s",
          "resolvedTitle": "Supertramp - Give A Little Bit",
          "channel": "SupertrampVEVO",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      },
      "supertramp-breakfast-in-america": {
          "videoId": "aQdoUUi3iJ8",
          "resolvedTitle": "Supertramp - Breakfast In America (Official Video)",
          "channel": "Supertramp ",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      },
      "america-a-horse-with-no-name": {
          "videoId": "LMJv9ZdVPTE",
          "resolvedTitle": "America - A Horse With No Name",
          "channel": "America",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      },
      "america-sister-golden-hair": {
          "videoId": "NYZJHjEiiGY",
          "resolvedTitle": "America - Sister Golden Hair on Dolby Atmos",
          "channel": "America",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      },
      "america-ventura-highway": {
          "videoId": "Wtc4I9QoK4Q",
          "resolvedTitle": "America - Ventura Highway (Lyric Video) (Official)",
          "channel": "AmericaVEVO",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      },
      "bread-everything-i-own": {
          "videoId": "_21cZe2eO_I",
          "resolvedTitle": "Everything I Own",
          "channel": "Bread - Topic",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      },
      "bread-make-it-with-you": {
          "videoId": "OudI2JPhEqQ",
          "resolvedTitle": "Make It with You",
          "channel": "Bread - Topic",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      },
      "gerry-rafferty-baker-street": {
          "videoId": "Fo6aKnRnBxM",
          "resolvedTitle": "Gerry Rafferty - Baker Street (Official Video)",
          "channel": "Gerry Rafferty",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      },
      "cat-stevens-wild-world": {
          "videoId": "P1b8z1h_rIs",
          "resolvedTitle": "Yusuf / Cat Stevens - Wild World (Live, 1971)",
          "channel": "Yusuf / Cat Stevens",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      },
      "steve-miller-band-the-joker": {
          "videoId": "dV3AziKTBUo",
          "resolvedTitle": "Steve Miller Band - The Joker (Official Music Video)",
          "channel": "SteveMillerBandVEVO",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      },
      "electric-light-orchestra-mr-blue-sky": {
          "videoId": "aQUlA8Hcv4s",
          "resolvedTitle": "Electric Light Orchestra - Mr. Blue Sky (Official Video)",
          "channel": "ELOVEVO",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      },
      "electric-light-orchestra-dont-bring-me-down": {
          "videoId": "z9nkzaOPP6g",
          "resolvedTitle": "Electric Light Orchestra - Don't Bring Me Down (Official Video)",
          "channel": "ELOVEVO",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      },
      "electric-light-orchestra-last-train-to-london": {
          "videoId": "Up4WjdabA2c",
          "resolvedTitle": "Electric Light Orchestra - Last Train to London (Official Video)",
          "channel": "ELOVEVO",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      },
      "electric-light-orchestra-telephone-line": {
          "videoId": "w1iRhy7Rl8E",
          "resolvedTitle": "Electric Light Orchestra - Telephone Line (Official Video)",
          "channel": "ELOVEVO",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      },
      "creedence-clearwater-revival-have-you-ever-seen-the-rain": {
          "videoId": "JKES3yfnD9U",
          "resolvedTitle": "Creedence Clearwater Revival - Have You Ever Seen The Rain (Official Audio)",
          "channel": "Creedence Clearwater Revival",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      },
      "creedence-clearwater-revival-proud-mary": {
          "videoId": "8quvq_GFEbQ",
          "resolvedTitle": "Creedence Clearwater Revival - Proud Mary (Official Audio)",
          "channel": "Creedence Clearwater Revival",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      },
      "creedence-clearwater-revival-down-on-the-corner": {
          "videoId": "YbvdHHcjMbE",
          "resolvedTitle": "Creedence Clearwater Revival - Down On The Corner (Official Audio)",
          "channel": "Creedence Clearwater Revival",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      },
      "creedence-clearwater-revival-up-around-the-bend": {
          "videoId": "dgah45hZZhY",
          "resolvedTitle": "Creedence Clearwater Revival - Up Around The Bend (Official Audio)",
          "channel": "Creedence Clearwater Revival",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      },
      "creedence-clearwater-revival-lookin-out-my-back-door": {
          "videoId": "YMpd3uFWImQ",
          "resolvedTitle": "Creedence Clearwater Revival - Lookin' Out My Back Door (Official Audio)",
          "channel": "Creedence Clearwater Revival",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      },
      "lynyrd-skynyrd-sweet-home-alabama": {
          "videoId": "SQjQrYWrtFw",
          "resolvedTitle": "Lynyrd Skynyrd – Sweet Home Alabama (Live From CMA Fest 2024)",
          "channel": "Lynyrd Skynyrd",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      },
      "the-doobie-brothers-long-train-runnin": {
          "videoId": "zpP4ytpunoY",
          "resolvedTitle": "Long Train Runnin’",
          "channel": "The Doobie Brothers - Topic",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      },
      "the-doobie-brothers-listen-to-the-music": {
          "videoId": "nbVE-1rHyVY",
          "resolvedTitle": "The Doobie Brothers - Listen To The Music (Official Audio)",
          "channel": "The Doobie Brothers",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      },
      "the-doobie-brothers-what-a-fool-believes": {
          "videoId": "qKYQNtF11eg",
          "resolvedTitle": "The Doobie Brothers - What A Fool Believes (Official Music Video) [HD]",
          "channel": "The Doobie Brothers",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      },
      "steely-dan-reelin-in-the-years": {
          "videoId": "91XTZ92zs2w",
          "resolvedTitle": "Reelin' In The Years",
          "channel": "Steely Dan - Topic",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      },
      "queen-dont-stop-me-now": {
          "videoId": "HgzGwKwLmgM",
          "resolvedTitle": "Queen - Don't Stop Me Now (Official Video)",
          "channel": "Queen Official",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      },
      "queen-crazy-little-thing-called-love": {
          "videoId": "zO6D_BAuYCI",
          "resolvedTitle": "Queen - Crazy Little Thing Called Love (Official Video)",
          "channel": "Queen Official",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      },
      "queen-another-one-bites-the-dust": {
          "videoId": "rY0WxgSXdEE",
          "resolvedTitle": "Queen - Another One Bites the Dust (Official Video Remastered)",
          "channel": "Queen Official",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      },
      "queen-under-pressure": {
          "videoId": "a01QQZyl-_I",
          "resolvedTitle": "Queen and David Bowie - Under Pressure (Official Video)",
          "channel": "Queen Official",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      },
      "queen-radio-ga-ga": {
          "videoId": "azdwsXLmrHE",
          "resolvedTitle": "Queen - Radio Ga Ga (Official Video)",
          "channel": "Queen Official",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      },
      "queen-i-want-to-break-free": {
          "videoId": "f4Mc-NYPHaQ",
          "resolvedTitle": "Queen - I Want To Break Free (Official Video)",
          "channel": "Queen Official",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      },
      "queen-a-kind-of-magic": {
          "videoId": "0p_1QSUsbsM",
          "resolvedTitle": "Queen - A Kind of Magic (Official Video Remastered)",
          "channel": "Queen Official",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      },
      "queen-youre-my-best-friend": {
          "videoId": "HaZpZQG2z10",
          "resolvedTitle": "Queen - You're My Best Friend (Official Video)",
          "channel": "Queen Official",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      },
      "simple-minds-dont-you-forget-about-me": {
          "videoId": "z8v84520W6s",
          "resolvedTitle": "Don't You (Forget About Me)",
          "channel": "Simple Minds - Topic",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      },
      "tears-for-fears-everybody-wants-to-rule-the-world": {
          "videoId": "T54cJGJcZ1Y",
          "resolvedTitle": "Everybody Wants To Rule The World – Official Archive Footage Music Video pt 2",
          "channel": "Tears For Fears",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      },
      "tears-for-fears-head-over-heels": {
          "videoId": "luOwnc5bqho",
          "resolvedTitle": "Head Over Heels",
          "channel": "Tears For Fears - Topic",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      },
      "a-ha-take-on-me": {
          "videoId": "Q5KLj2a47ow",
          "resolvedTitle": "a-ha - Take On Me (Official Video)",
          "channel": "a-ha",
          "source": "youtube-iframe-physical",
          "lastValidatedAt": "2026-08-26T03:39:15.563Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": true,
          "physicalValidation": {
              "method": "youtube_iframe_api_http_origin",
              "status": "PLAY_CONFIRMED",
              "error": null,
              "testedCandidateIds": ["djV11Xbc914","Q5KLj2a47ow","-iKeUC5_Wyw","jg5mXCCbd0U"]
          }
      },
      "a-ha-the-sun-always-shines-on-tv": {
          "videoId": "a3ir9HC9vYg",
          "resolvedTitle": "a-ha - The Sun Always Shines on T.V. (Official Video)",
          "channel": "a-ha",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      },
      "the-cars-drive": {
          "videoId": "cAxA-okbK_Q",
          "resolvedTitle": "Drive (2017 Remaster)",
          "channel": "The Cars - Topic",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      },
      "bryan-adams-summer-of-69": {
          "videoId": "9f06QZCVUHg",
          "resolvedTitle": "Bryan Adams - Summer Of 69 (Official Music Video)",
          "channel": "Bryan Adams",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      },
      "bryan-adams-run-to-you": {
          "videoId": "_g2g2v4QiZM",
          "resolvedTitle": "Bryan Adams - Run To You (Classic Version)",
          "channel": "Bryan Adams",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      },
      "bryan-adams-heaven": {
          "videoId": "3eT464L1YRA",
          "resolvedTitle": "Bryan Adams - Heaven (Official Music Video)",
          "channel": "Bryan Adams",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      },
      "huey-lewis-and-the-news-the-power-of-love": {
          "videoId": "wBl2QGAIx1s",
          "resolvedTitle": "Huey Lewis & The News - The Power Of Love (Official Music Video)",
          "channel": "HueyLewisTheNewsVEVO",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      },
      "huey-lewis-and-the-news-stuck-with-you": {
          "videoId": "UhSZfc4l2yg",
          "resolvedTitle": "Stuck With You (Single Edit)",
          "channel": "Huey Lewis & The News - Topic",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      },
      "rick-springfield-jessies-girl": {
          "videoId": "qYkbTyHXwbs",
          "resolvedTitle": "Rick Springfield - Jessie's Girl (Official Video)",
          "channel": "RickSpringfieldVEVO",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      },
      "john-mellencamp-jack-and-diane": {
          "videoId": "h04CH9YZcpI",
          "resolvedTitle": "John Mellencamp - Jack & Diane (Official Music Video)",
          "channel": "JohnMellencampVEVO",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      },
      "john-mellencamp-hurts-so-good": {
          "videoId": "4dOsbsuhYGQ",
          "resolvedTitle": "John Mellencamp - Hurts So Good (Official Music Video)",
          "channel": "JohnMellencampVEVO",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      },
      "billy-idol-dancing-with-myself": {
          "videoId": "cniSxTAbuco",
          "resolvedTitle": "Dancing with Myself (2001 Remaster)",
          "channel": "Billy Idol - Topic",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      },
      "billy-idol-eyes-without-a-face": {
          "videoId": "G_GxaoOJFTY",
          "resolvedTitle": "Eyes Without A Face (Remastered 1999)",
          "channel": "Billy Idol - Topic",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      },
      "bon-jovi-you-give-love-a-bad-name": {
          "videoId": "KrZHPOeOxQQ",
          "resolvedTitle": "Bon Jovi - You Give Love A Bad Name",
          "channel": "BonJoviVEVO",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      },
      "bon-jovi-wanted-dead-or-alive": {
          "videoId": "SRvCvsRp5ho",
          "resolvedTitle": "Bon Jovi - Wanted Dead Or Alive (Official Music Video)",
          "channel": "BonJoviVEVO",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      },
      "bon-jovi-its-my-life": {
          "videoId": "vx2u5uUu3DE",
          "resolvedTitle": "Bon Jovi - It's My Life (Official Music Video)",
          "channel": "BonJoviVEVO",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      },
      "bon-jovi-always": {
          "videoId": "9BMwcO6_hyA",
          "resolvedTitle": "Bon Jovi - Always (Official Music Video)",
          "channel": "BonJoviVEVO",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      },
      "aerosmith-dream-on": {
          "videoId": "kR4zpS-ky9o",
          "resolvedTitle": "Aerosmith - Dream On (Lyric Video)",
          "channel": "AerosmithVEVO",
          "source": "youtube-iframe-physical",
          "lastValidatedAt": "2026-08-26T03:39:15.563Z",
          "validationStatus": "REJECTED_PHYSICAL",
          "playConfirmed": false,
          "physicalValidation": {
              "method": "youtube_iframe_api_http_origin",
              "status": "REJECTED_IFRAME_ERROR",
              "error": "youtube_error_150",
              "testedCandidateIds": ["iJDtukGW79Y","89dGC8de0CA","kR4zpS-ky9o","NeSpx7vZifc"]
          }
      },
      "aerosmith-i-dont-want-to-miss-a-thing": {
          "videoId": "JkK8g6FMEXE",
          "resolvedTitle": "Aerosmith - I Don't Want to Miss a Thing (Official HD Video)",
          "channel": "AerosmithVEVO",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      },
      "aerosmith-crazy": {
          "videoId": "NMNgbISmF4I",
          "resolvedTitle": "Aerosmith - Crazy (Official Music Video)",
          "channel": "AerosmithVEVO",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      },
      "van-halen-jump": {
          "videoId": "SwYN7mTi6HM",
          "resolvedTitle": "Van Halen - Jump (Official Music Video) [HD]",
          "channel": "Van Halen",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      },
      "van-halen-why-cant-this-be-love": {
          "videoId": "IONcKbWeyQM",
          "resolvedTitle": "Van Halen - Why Can't This Be Love [Official Video]",
          "channel": "Van Halen",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      },
      "heart-barracuda": {
          "videoId": "VdOkQ6THDVw",
          "resolvedTitle": "Heart - Barracuda (Official Audio)",
          "channel": "HeartVEVO",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      },
      "heart-alone": {
          "videoId": "1Cw1ng75KP0",
          "resolvedTitle": "Heart - Alone",
          "channel": "HeartVEVO",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      },
      "joan-jett-and-the-blackhearts-i-love-rock-n-roll": {
          "videoId": "wMsazR6Tnf8",
          "resolvedTitle": "\"I Love Rock 'n' Roll\" - Joan Jett & the Blackhearts (Official Video)",
          "channel": "Joan Jett and the Blackhearts",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      },
      "pat-benatar-hit-me-with-your-best-shot": {
          "videoId": "0JRgHol94Xc",
          "resolvedTitle": "Pat Benatar - Hit Me With Your Best Shot (Live) (Official Music Video)",
          "channel": "PatBenatarVEVO",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      },
      "the-police-every-breath-you-take": {
          "videoId": "OMOGaugKpzs",
          "resolvedTitle": "The Police - Every Breath You Take (Official Music Video)",
          "channel": "ThePoliceVEVO",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      },
      "the-police-message-in-a-bottle": {
          "videoId": "MbXWrmQW-OE",
          "resolvedTitle": "The Police - Message In A Bottle (Official Music Video)",
          "channel": "ThePoliceVEVO",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      },
      "the-police-every-little-thing-she-does-is-magic": {
          "videoId": "aENX1Sf3fgQ",
          "resolvedTitle": "The Police - Every Little Thing She Does Is Magic (Official Music Video)",
          "channel": "ThePoliceVEVO",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      },
      "u2-with-or-without-you": {
          "videoId": "ujNeHIo7oTE",
          "resolvedTitle": "U2 - With Or Without You (Official Music Video)",
          "channel": "U2VEVO",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      },
      "u2-beautiful-day": {
          "videoId": "co6WMzDOh1o",
          "resolvedTitle": "U2 - Beautiful Day (Official Music Video)",
          "channel": "U2VEVO",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      },
      "u2-where-the-streets-have-no-name": {
          "videoId": "GzZWSrr5wFI",
          "resolvedTitle": "U2 - Where The Streets Have No Name (Official Music Video)",
          "channel": "U2VEVO",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      },
      "rem-man-on-the-moon": {
          "videoId": "i2D9bDbbMeY",
          "resolvedTitle": "Man On The Moon",
          "channel": "R.E.M. - Topic",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      },
      "rem-the-one-i-love": {
          "videoId": "j7oQEPfe-O8",
          "resolvedTitle": "R.E.M. - The One I Love (Official Music Video)",
          "channel": "REMVEVO",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      },
      "the-cranberries-dreams": {
          "videoId": "Yam5uK6e-bQ",
          "resolvedTitle": "The Cranberries - Dreams (Dir: Peter Scammell) (Official Music Video)",
          "channel": "TheCranberriesVEVO",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      },
      "the-cranberries-linger": {
          "videoId": "G6Kspj3OO0s",
          "resolvedTitle": "The Cranberries - Linger (4K Official Music Video)",
          "channel": "TheCranberriesVEVO",
          "source": "youtube-iframe-physical",
          "lastValidatedAt": "2026-08-26T03:39:15.563Z",
          "validationStatus": "REJECTED_PHYSICAL",
          "playConfirmed": false,
          "physicalValidation": {
              "method": "youtube_iframe_api_http_origin",
              "status": "REJECTED_IFRAME_ERROR",
              "error": "youtube_error_150",
              "testedCandidateIds": ["G6Kspj3OO0s","fSlwn8xv8W0","CGRwhcqY1gg","cFbnefNNy_Q"]
          }
      },
      "the-cure-friday-im-in-love": {
          "videoId": "8AEgojGUBW8",
          "resolvedTitle": "THE CURE - FRIDAY IM IN LOVE (OPENER FESTIVAL 2026)",
          "channel": "The Cure",
          "source": "youtube-iframe-physical",
          "lastValidatedAt": "2026-08-26T03:39:15.563Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": true,
          "physicalValidation": {
              "method": "youtube_iframe_api_http_origin",
              "status": "PLAY_CONFIRMED",
              "error": null,
              "testedCandidateIds": ["8AEgojGUBW8"]
          }
      },
      "tom-petty-i-wont-back-down": {
          "videoId": "uh0-OMx9K3I",
          "resolvedTitle": "Tom Petty & The Heartbreakers - I Won't Back Down (Live at the Fillmore, 1997) [Official Audio]",
          "channel": "Tom Petty & The Heartbreakers",
          "source": "youtube-catalog",
          "lastValidatedAt": "2026-08-26T02:11:53.894Z",
          "validationStatus": "ACTIVE",
          "playConfirmed": false
      }
  };

  const ITEMS = RAW_TRACKS.map(function (track) {
    const id = track[0];
    const title = track[1];
    const artist = track[2];
    const normalizedTitle = normalize(title);
    const normalizedArtist = normalize(artist);
    const video = VALIDATED_VIDEO_METADATA[id] || {};
    return {
      id: id,
      title: title,
      artist: artist,
      normalizedTitle: normalizedTitle,
      normalizedArtist: normalizedArtist,
      normalizedLabel: normalize(artist + " " + title),
      aliases: buildAliases(id, title, artist),
      searchQuery: artist + " " + title,
      videoId: video.videoId || null,
      playable: !!video.videoId && video.validationStatus === "ACTIVE",
      embeddable: !!video.videoId && video.validationStatus === "ACTIVE",
      resolvedTitle: video.resolvedTitle || null,
      channel: video.channel || null,
      lastValidatedAt: video.lastValidatedAt || null,
      source: video.source || "elo-music-catalog",
      validationStatus: video.validationStatus || "PENDING",
      playConfirmed: video.playConfirmed === true,
      physicalValidation: video.physicalValidation || null
    };
  });

  const BY_ID = ITEMS.reduce(function (map, item) {
    map[item.id] = item;
    return map;
  }, {});

  function score(query, item) {
    const normalized = normalize(query);
    if (!normalized) return 0;
    const candidates = [item.normalizedTitle, item.normalizedLabel].concat(item.aliases || []);
    let best = 0;
    candidates.forEach(function (candidate) {
      if (!candidate) return;
      if (candidate === normalized) best = Math.max(best, 1);
      if (candidate.indexOf(normalized) >= 0 || normalized.indexOf(candidate) >= 0) best = Math.max(best, 0.92);
      const queryTokens = normalized.split(" ").filter(Boolean);
      const candidateTokens = candidate.split(" ").filter(Boolean);
      const hits = queryTokens.filter(function (token) { return candidateTokens.indexOf(token) >= 0; }).length;
      if (queryTokens.length) best = Math.max(best, hits / queryTokens.length);
    });
    return best;
  }

  function clone(item) {
    return item ? Object.assign({}, item, { aliases: (item.aliases || []).slice() }) : null;
  }

  function list() {
    return ITEMS.map(clone);
  }

  function get(id) {
    return clone(BY_ID[clean(id)]);
  }

  function find(query) {
    const ranked = ITEMS.map(function (item) {
      return { item: item, score: score(query, item) };
    }).sort(function (a, b) { return b.score - a.score; });
    return ranked[0] && ranked[0].score >= 0.72 ? Object.assign(clone(ranked[0].item), { catalogScore: ranked[0].score }) : null;
  }

  window.EloMusicCatalog = {
    version: "20260825-catalog-100-v1",
    items: ITEMS,
    tracks: ITEMS,
    normalize: normalize,
    list: list,
    find: find,
    get: get
  };
  window.ELO_MUSIC_CATALOG = window.EloMusicCatalog;
})();


