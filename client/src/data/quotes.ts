export interface QuoteItem {
  id: string;
  text: string;
  author: string;
  source: string;
  year: string;
  affiliation: "left" | "right" | "neutral";
}

/*
 * Quote library — labeling and sourcing policy
 *
 * - Every quote's wording, speaker, source, and year was checked against a
 *   primary source or reputable archive (American Presidency Project,
 *   Avalon Project, Founders Online / Massachusetts Historical Society,
 *   presidential libraries, contemporaneous transcripts). Quotes that were
 *   spliced, misattributed, or could not be traced to a source were removed.
 * - "left" / "right" = figures whose public career was mainly after 1950 and
 *   who held office or ran as a Democrat ("left") or Republican ("right").
 * - "neutral" = figures whose careers ended before 1950 (founders, Lincoln,
 *   T. Roosevelt, Wilson, Coolidge, FDR), civil-rights and suffrage leaders
 *   who never held party office, writers, and Supreme Court justices.
 * - The left and right pools are kept the same size, with at most two quotes
 *   per person, and contain only quotes about voting, democracy, and civic
 *   duty. Nothing in either pool attacks the other side.
 */
export const QUOTES: QuoteItem[] = [
  // ── Left (Democratic figures, post-1950) ──────────────────────────────
  {
    "id": "jfk-ask",
    "text": "Ask not what your country can do for you — ask what you can do for your country.",
    "author": "John F. Kennedy",
    "source": "Inaugural Address",
    "year": "1961",
    "affiliation": "left"
  },
  {
    "id": "jfk-right",
    "text": "Let us not seek the Republican answer or the Democratic answer but the right answer. Let us not seek to fix the blame for the past — let us accept our own responsibility for the future.",
    "author": "John F. Kennedy",
    "source": "Remarks at the Loyola College Alumni Banquet, Baltimore, Maryland",
    "year": "1958",
    "affiliation": "left"
  },
  {
    "id": "truman-democracy",
    "text": "Democracy is based on the conviction that man has the moral and intellectual capacity, as well as the inalienable right, to govern himself with reason and justice.",
    "author": "Harry S. Truman",
    "source": "Inaugural Address",
    "year": "1949",
    "affiliation": "left"
  },
  {
    "id": "truman-courage",
    "text": "America was not built on fear. America was built on courage, on imagination and an unbeatable determination to do the job at hand.",
    "author": "Harry S. Truman",
    "source": "Special Message to the Congress: The President's First Economic Report",
    "year": "1947",
    "affiliation": "left"
  },
  {
    "id": "lbj-vote",
    "text": "Every American citizen must have an equal right to vote. There is no reason which can excuse the denial of that right. There is no duty which weighs more heavily on us than the duty we have to ensure that right.",
    "author": "Lyndon B. Johnson",
    "source": "Special Message to the Congress: The American Promise ('We Shall Overcome' Speech)",
    "year": "1965",
    "affiliation": "left"
  },
  {
    "id": "lbj-dignity",
    "text": "I speak tonight for the dignity of man and the destiny of democracy.",
    "author": "Lyndon B. Johnson",
    "source": "Special Message to the Congress: The American Promise ('We Shall Overcome' Speech)",
    "year": "1965",
    "affiliation": "left"
  },
  {
    "id": "eleanor-democracy",
    "text": "In the final analysis, a democratic government represents the sum total of the courage and the integrity of its individuals. It cannot be better than they are.",
    "author": "Eleanor Roosevelt",
    "source": "Tomorrow Is Now",
    "year": "1963",
    "affiliation": "left"
  },
  {
    "id": "carter-dream",
    "text": "The American dream endures. We must once again have full faith in our country — and in one another.",
    "author": "Jimmy Carter",
    "source": "Inaugural Address",
    "year": "1977",
    "affiliation": "left"
  },
  {
    "id": "carter-faith",
    "text": "We simply must have faith in each other, faith in our ability to govern ourselves, and faith in the future of this Nation. Restoring that faith and that confidence to America is now the most important task we face.",
    "author": "Jimmy Carter",
    "source": "Address to the Nation on Energy and National Goals ('Crisis of Confidence' Speech)",
    "year": "1979",
    "affiliation": "left"
  },
  {
    "id": "clinton-renewal",
    "text": "There is nothing wrong with America that cannot be cured by what is right with America.",
    "author": "Bill Clinton",
    "source": "First Inaugural Address",
    "year": "1993",
    "affiliation": "left"
  },
  {
    "id": "clinton-posterity",
    "text": "Posterity is the world to come: the world for whom we hold our ideals, from whom we have borrowed our planet, and to whom we bear sacred responsibility. We must do what America does best: offer more opportunity to all and demand more responsibility from all.",
    "author": "Bill Clinton",
    "source": "First Inaugural Address",
    "year": "1993",
    "affiliation": "left"
  },
  {
    "id": "obama-united",
    "text": "There's not a liberal America and a conservative America — there's the United States of America. There's not a black America and white America and Latino America and Asian America; there's the United States of America.",
    "author": "Barack Obama",
    "source": "Keynote Address, Democratic National Convention",
    "year": "2004",
    "affiliation": "left"
  },
  {
    "id": "obama-citizenship",
    "text": "As citizens, we understand that America is not about what can be done for us; it's about what can be done by us, together, through the hard and frustrating, but necessary work of self-government.",
    "author": "Barack Obama",
    "source": "Remarks Accepting the Presidential Nomination, Democratic National Convention",
    "year": "2012",
    "affiliation": "left"
  },
  {
    "id": "lewis-vote",
    "text": "Your vote is precious, almost sacred. It is the most powerful nonviolent tool we have to create a more perfect union.",
    "author": "John Lewis",
    "source": "Address to the Democratic National Convention, Charlotte",
    "year": "2012",
    "affiliation": "left"
  },
  {
    "id": "lewis-freedom",
    "text": "Freedom is not a state; it is an act. It is not some enchanted garden perched high on a distant plateau where we can finally sit down and rest. Freedom is the continuous action we all must take, and each generation must do its part to create an even more fair, more just society.",
    "author": "John Lewis",
    "source": "Across That Bridge: A Vision for Change and the Future of America",
    "year": "2012",
    "affiliation": "left"
  },
  {
    "id": "harris-democracy",
    "text": "Protecting our democracy takes struggle. It takes sacrifice. There is joy in it and there is progress. Because \"We the People\" have the power to build a better future.",
    "author": "Kamala Harris",
    "source": "Vice President-elect Victory Speech, Wilmington, Delaware",
    "year": "2020",
    "affiliation": "left"
  },
  {
    "id": "biden-listen",
    "text": "Let's begin to listen to one another, hear one another, see one another, show respect to one another. Politics doesn't have to be a raging fire destroying everything in its path. Every disagreement doesn't have to be a cause for total war.",
    "author": "Joe Biden",
    "source": "Inaugural Address",
    "year": "2021",
    "affiliation": "left"
  },

  // ── Right (Republican figures, post-1950) ─────────────────────────────
  {
    "id": "eisenhower-freedom",
    "text": "For history does not long entrust the care of freedom to the weak or the timid.",
    "author": "Dwight D. Eisenhower",
    "source": "First Inaugural Address",
    "year": "1953",
    "affiliation": "right"
  },
  {
    "id": "eisenhower-principles",
    "text": "A people that values its privileges above its principles soon loses both.",
    "author": "Dwight D. Eisenhower",
    "source": "First Inaugural Address",
    "year": "1953",
    "affiliation": "right"
  },
  {
    "id": "smithmcs-conscience",
    "text": "It is high time that we stopped thinking politically as Republicans and Democrats about elections and started thinking patriotically as Americans about national security based on individual freedom.",
    "author": "Margaret Chase Smith",
    "source": "Declaration of Conscience, U.S. Senate",
    "year": "1950",
    "affiliation": "right"
  },
  {
    "id": "smithmcs-rights",
    "text": "The right to criticize; the right to hold unpopular beliefs; the right to protest; the right of independent thought.",
    "author": "Margaret Chase Smith",
    "source": "Declaration of Conscience Speech, U.S. Senate",
    "year": "1950",
    "affiliation": "right"
  },
  {
    "id": "nixon-listen",
    "text": "We cannot learn from one another until we stop shouting at one another — until we speak quietly enough so that our words can be heard as well as our voices.",
    "author": "Richard Nixon",
    "source": "First Inaugural Address",
    "year": "1969",
    "affiliation": "right"
  },
  {
    "id": "nixon-together",
    "text": "What has to be done, has to be done by government and people together or it will not be done at all. The lesson of past agony is that without the people we can do nothing — with the people we can do everything.",
    "author": "Richard Nixon",
    "source": "First Inaugural Address",
    "year": "1969",
    "affiliation": "right"
  },
  {
    "id": "ford-constitution",
    "text": "Our Constitution works; our great Republic is a government of laws and not of men. Here the people rule.",
    "author": "Gerald R. Ford",
    "source": "Remarks on Taking the Oath of Office",
    "year": "1974",
    "affiliation": "right"
  },
  {
    "id": "ford-truth",
    "text": "I believe that truth is the glue that holds government together, not only our Government but civilization itself.",
    "author": "Gerald R. Ford",
    "source": "Remarks on Taking the Oath of Office",
    "year": "1974",
    "affiliation": "right"
  },
  {
    "id": "reagan-freedom",
    "text": "Freedom is a fragile thing and it's never more than one generation away from extinction. It is not ours by way of inheritance; it must be fought for and defended constantly by each generation, for it comes only once to a people.",
    "author": "Ronald Reagan",
    "source": "Inaugural Address as Governor of California",
    "year": "1967",
    "affiliation": "right"
  },
  {
    "id": "reagan-selfgov",
    "text": "We are a nation that has a government — not the other way around. And this makes us special among the nations of the Earth. Our government has no power except that granted it by the people.",
    "author": "Ronald Reagan",
    "source": "First Inaugural Address",
    "year": "1981",
    "affiliation": "right"
  },
  {
    "id": "ghwbush-freedom",
    "text": "We know what works: Freedom works. We know what's right: Freedom is right. We know how to secure a more just and prosperous life for man on Earth: through free markets, free speech, free elections, and the exercise of free will unhampered by the state.",
    "author": "George H.W. Bush",
    "source": "Inaugural Address",
    "year": "1989",
    "affiliation": "right"
  },
  {
    "id": "ghwbush-democracy",
    "text": "Democracy belongs to us all, and freedom is like a beautiful kite that can go higher and higher with the breeze.",
    "author": "George H.W. Bush",
    "source": "Inaugural Address",
    "year": "1989",
    "affiliation": "right"
  },
  {
    "id": "gwbush-citizens",
    "text": "America has never been united by blood or birth or soil. We are bound by ideals that move us beyond our backgrounds, lift us above our interests, and teach us what it means to be citizens.",
    "author": "George W. Bush",
    "source": "First Inaugural Address",
    "year": "2001",
    "affiliation": "right"
  },
  {
    "id": "gwbush-freedom",
    "text": "Freedom, by its nature, must be chosen and defended by citizens and sustained by the rule of law and the protection of minorities.",
    "author": "George W. Bush",
    "source": "Second Inaugural Address",
    "year": "2005",
    "affiliation": "right"
  },
  {
    "id": "mccain-americans",
    "text": "Whatever our differences, we are fellow Americans. And please believe me when I say no association has ever meant more to me than that.",
    "author": "John McCain",
    "source": "Concession Speech, Phoenix, Arizona",
    "year": "2008",
    "affiliation": "right"
  },
  {
    "id": "mccain-history",
    "text": "Americans never quit. We never surrender. We never hide from history. We make history.",
    "author": "John McCain",
    "source": "Concession Speech, Phoenix, Arizona",
    "year": "2008",
    "affiliation": "right"
  },
  {
    "id": "rice-idea",
    "text": "The essence of America — that which really unites us — is not ethnicity, or nationality or religion — it is an idea — and what an idea it is: That you can come from humble circumstances and do great things.",
    "author": "Condoleezza Rice",
    "source": "Address to the Republican National Convention (as prepared), Tampa",
    "year": "2012",
    "affiliation": "right"
  },

  // ── Neutral (pre-1950 figures, non-party leaders, writers, justices) ──
  {
    "id": "washington-union",
    "text": "The name of American, which belongs to you in your national capacity, must always exalt the just pride of patriotism more than any appellation derived from local discriminations.",
    "author": "George Washington",
    "source": "Farewell Address",
    "year": "1796",
    "affiliation": "neutral"
  },
  {
    "id": "washington-constitution",
    "text": "The basis of our political systems is the right of the people to make and to alter their constitutions of government. But the Constitution which at any time exists, till changed by an explicit and authentic act of the whole people, is sacredly obligatory upon all.",
    "author": "George Washington",
    "source": "Farewell Address",
    "year": "1796",
    "affiliation": "neutral"
  },
  {
    "id": "franklin-republic",
    "text": "A republic, if you can keep it.",
    "author": "Benjamin Franklin",
    "source": "Reply recorded in the journal of James McHenry, Constitutional Convention",
    "year": "1787",
    "affiliation": "neutral"
  },
  {
    "id": "adams-liberty",
    "text": "Liberty must at all hazards be supported. We have a right to it, derived from our Maker.",
    "author": "John Adams",
    "source": "A Dissertation on the Canon and the Feudal Law, No. 3",
    "year": "1765",
    "affiliation": "neutral"
  },
  {
    "id": "adams-knowledge",
    "text": "Liberty cannot be preserved without a general knowledge among the people.",
    "author": "John Adams",
    "source": "A Dissertation on the Canon and the Feudal Law, No. 3",
    "year": "1765",
    "affiliation": "neutral"
  },
  {
    "id": "jefferson-people",
    "text": "I know no safe depository of the ultimate powers of the society but the people themselves; and if we think them not enlightened enough to exercise their control with a wholesome discretion, the remedy is not to take it from them, but to inform their discretion by education.",
    "author": "Thomas Jefferson",
    "source": "Letter to William Charles Jarvis",
    "year": "1820",
    "affiliation": "neutral"
  },
  {
    "id": "jefferson-tyranny",
    "text": "I have sworn upon the altar of God eternal hostility against every form of tyranny over the mind of man.",
    "author": "Thomas Jefferson",
    "source": "Letter to Dr. Benjamin Rush",
    "year": "1800",
    "affiliation": "neutral"
  },
  {
    "id": "madison-people",
    "text": "[T]he people are the only legitimate fountain of power, and it is from them that the constitutional charter, under which the several branches of government hold their power, is derived.",
    "author": "James Madison",
    "source": "The Federalist No. 49",
    "year": "1788",
    "affiliation": "neutral"
  },
  {
    "id": "hamilton-government",
    "text": "The true test of a good government is its aptitude and tendency to produce a good administration.",
    "author": "Alexander Hamilton",
    "source": "The Federalist No. 68",
    "year": "1788",
    "affiliation": "neutral"
  },
  {
    "id": "lincoln-democracy",
    "text": "As I would not be a slave, so I would not be a master. This expresses my idea of democracy. Whatever differs from this, to the extent of the difference, is no democracy.",
    "author": "Abraham Lincoln",
    "source": "Fragment on Democracy (date conjectural)",
    "year": "1858",
    "affiliation": "neutral"
  },
  {
    "id": "lincoln-gettysburg",
    "text": "Four score and seven years ago our fathers brought forth on this continent, a new nation, conceived in Liberty, and dedicated to the proposition that all men are created equal.",
    "author": "Abraham Lincoln",
    "source": "Gettysburg Address",
    "year": "1863",
    "affiliation": "neutral"
  },
  {
    "id": "douglass-liberty",
    "text": "Liberty is meaningless where the right to utter one's thoughts and opinions has ceased to exist.",
    "author": "Frederick Douglass",
    "source": "A Plea for Free Speech in Boston",
    "year": "1860",
    "affiliation": "neutral"
  },
  {
    "id": "anthony-people",
    "text": "It was we, the people; not we, the white male citizens; nor yet we, the male citizens; but we, the whole people, who formed the Union.",
    "author": "Susan B. Anthony",
    "source": "Is It a Crime for a Citizen of the United States to Vote?",
    "year": "1873",
    "affiliation": "neutral"
  },
  {
    "id": "tubman-liberty",
    "text": "I had reasoned this out in my mind; there was one of two things I had a right to, liberty, or death; if I could not have one, I would have the other; for no man should take me alive.",
    "author": "Harriet Tubman",
    "source": "As recorded by Sarah H. Bradford, Harriet, the Moses of Her People (dialect spelling modernized)",
    "year": "1886",
    "affiliation": "neutral"
  },
  {
    "id": "twain-republic",
    "text": "Citizenship is what makes a republic; monarchies can get along without it. What keeps a republic on its legs is good citizenship.",
    "author": "Mark Twain",
    "source": "\"Layman's Sermon,\" Majestic Theatre, New York",
    "year": "1906",
    "affiliation": "neutral"
  },
  {
    "id": "tr-democracy",
    "text": "Our country — this great Republic — means nothing unless it means the triumph of a real democracy, the triumph of popular government, and, in the long run, of an economic system under which each man shall be guaranteed the opportunity to show the best that there is in him.",
    "author": "Theodore Roosevelt",
    "source": "The New Nationalism Speech, Osawatomie, Kansas",
    "year": "1910",
    "affiliation": "neutral"
  },
  {
    "id": "wilson-liberty",
    "text": "Liberty does not consist, my fellow-citizens, in mere general declarations of the rights of man. It consists in the translation of those declarations into definite action.",
    "author": "Woodrow Wilson",
    "source": "Address at Independence Hall: \"The Meaning of Liberty\"",
    "year": "1914",
    "affiliation": "neutral"
  },
  {
    "id": "coolidge-democracy",
    "text": "Democracy is not a tearing-down; it is a building-up. It is not a denial of the divine right of kings; it supplements that claim with the assertion of the divine right of all men. It does not destroy; it fulfils.",
    "author": "Calvin Coolidge",
    "source": "Address at the Home of Daniel Webster, Marshfield, Massachusetts",
    "year": "1916",
    "affiliation": "neutral"
  },
  {
    "id": "coolidge-government",
    "text": "It is not the enactment, but the observance of laws, that creates the character of a nation.",
    "author": "Calvin Coolidge",
    "source": "Address at the Celebration of the 150th Anniversary of the Declaration of Independence, Philadelphia",
    "year": "1926",
    "affiliation": "neutral"
  },
  {
    "id": "fdr-freedom",
    "text": "In the future days, which we seek to make secure, we look forward to a world founded upon four essential human freedoms.",
    "author": "Franklin D. Roosevelt",
    "source": "Annual Message to Congress (Four Freedoms Speech)",
    "year": "1941",
    "affiliation": "neutral"
  },
  {
    "id": "fdr-democracy",
    "text": "Freedom means the supremacy of human rights everywhere. Our support goes to those who struggle to gain those rights or keep them. Our strength is our unity of purpose.",
    "author": "Franklin D. Roosevelt",
    "source": "Annual Message to Congress (Four Freedoms Speech)",
    "year": "1941",
    "affiliation": "neutral"
  },
  {
    "id": "mlk-justice",
    "text": "Injustice anywhere is a threat to justice everywhere. We are caught in an inescapable network of mutuality, tied in a single garment of destiny. Whatever affects one directly, affects all indirectly.",
    "author": "Martin Luther King Jr.",
    "source": "Letter from Birmingham Jail",
    "year": "1963",
    "affiliation": "neutral"
  },
  {
    "id": "mlk-arc",
    "text": "We shall overcome because the arc of the moral universe is long, but it bends toward justice.",
    "author": "Martin Luther King Jr.",
    "source": "\"Remaining Awake Through a Great Revolution,\" Washington National Cathedral",
    "year": "1968",
    "affiliation": "neutral"
  },
  {
    "id": "rbg-constitution",
    "text": "A constitution, as important as it is, will mean nothing unless the people are yearning for liberty and freedom.",
    "author": "Ruth Bader Ginsburg",
    "source": "Interview with Al Hayat TV, Egypt",
    "year": "2012",
    "affiliation": "neutral"
  },
  {
    "id": "rbg-fight",
    "text": "Fight for the things that you care about, but do it in a way that will lead others to join you.",
    "author": "Ruth Bader Ginsburg",
    "source": "Radcliffe Day, Harvard University",
    "year": "2015",
    "affiliation": "neutral"
  }
];
