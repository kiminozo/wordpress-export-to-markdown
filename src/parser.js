const fs = require('fs');
const luxon = require('luxon');
const xml2js = require('xml2js');

const shared = require('./shared');
const translator = require('./translator');
const path = require('path');

async function parseFilePromise(config) {
	console.log('\nParsing...');
	const content = await fs.promises.readFile(config.input, 'utf8');
	const data = await xml2js.parseStringPromise(content, {
		trim: true,
		tagNameProcessors: [xml2js.processors.stripPrefix]
	});

	const posts = collectPosts(data, config);

	const images = [];
	if (config.saveAttachedImages) {
		images.push(...collectAttachedImages(data));
	}
	if (config.saveScrapedImages) {
		images.push(...collectScrapedImages(data));
	}

	mergeImagesIntoPosts(images, posts);

	return posts;
}

function getItemsOfType(data, type) {
	return data.rss.channel[0].item.filter(item => item.post_type[0] === type);
}

function collectPosts(data, config) {
	// this is passed into getPostContent() for the markdown conversion
	const turndownService = translator.initTurndownService();

	// const posts = getItemsOfType(data, 'post')//, 'song'
	// 	.filter(post => post.status[0] !== 'trash' && post.status[0] !== 'draft')
	// 	.map(post => ({
	// 		// meta data isn't written to file, but is used to help with other things
	// 		meta: {
	// 			id: getPostId(post),
	// 			slug: getPostSlug(post),
	// 			coverImageId: getPostCoverImageId(post),
	// 			dir: getDir(post),
	// 			imageUrls: []
	// 		},
	// 		frontmatter: {
	// 			title: getPostTitle(post),
	// 			date: getPostDate(post),
	// 			categories: getPostCategories(post),//["1"],
	// 			slug: getPostFullSlug(post),
	// 			tags: getPostTags(post),
	// 			license: getLicense(post),
	// 		},
	// 		content: translator.getPostContent(post, turndownService, config)
	// 	}));

	// console.log(posts.length + ' posts found.');


	//SONG
	const songs = getItemsOfType(data, 'song')//, 'song'
		.filter(post => post.status[0] !== 'trash' && post.status[0] !== 'draft')
		.map(post => ({
			// meta data isn't written to file, but is used to help with other things
			meta: {
				id: getPostId(post),
				slug: getPostTitle(post),
				coverImageId: getPostCoverImageId(post),
				imageUrls: [],
				dir: path.join("songs", getSongSinger(post), getSongTags(post, 'discography')[0])
			},
			frontmatter: {
				title: getPostTitle(post),
				type: "song",
				date: getPostDate(post),
				order: getPostOrder(post),
				discography: getSongTags(post, 'discography'),
				discographyId: getSongNiceName(post, 'discography'),
				singer: getSongTags(post, 'singer'),
				songwriter: getSongTags(post, 'songwriter'),
				lyricwriter: getSongTags(post, 'lyricwriter'),
				arranger: getSongTags(post, 'arranger'),
				slug: 'songs/' + decodeURI(getPostSlug(post)),
				tags: getPostTags(post),
				remarks: getMeta(post, 'song-remarks'),
				license: getLicense(post),
			},
			content: translator.getPostContent(post, turndownService, config)
		}));

	// console.log(songs.length + ' songs found.');

	// const records = getItemsOfType(data, 'record')//, 'record'
	// 	.filter(post => post.status[0] !== 'trash' && post.status[0] !== 'draft')
	// 	.map(post => ({
	// 		// meta data isn't written to file, but is used to help with other things
	// 		meta: {
	// 			id: getPostId(post),
	// 			slug: getPostSlug(post),
	// 			coverImageId: getPostCoverImageId(post),
	// 			imageUrls: [],
	// 			dir: "record"
	// 		},
	// 		frontmatter: {
	// 			id: getPostSlug(post),
	// 			title: getPostTitle(post),
	// 			type: "record",
	// 			date: getPostDate(post),
	// 			//discography: getMeta(post, 'discography'),
	// 			recordNo: getMeta(post, 'record-no'),
	// 			recordPrice: getMeta(post, 'record-price'),
	// 			recordReleaseDate: getMeta(post, 'record-release-date'),
	// 			recordPublisher: getMeta(post, 'record-publisher'),
	// 			recordType: getMeta(post, 'record-type'),
	// 			order: getPostOrder(post),
	// 			slug: 'discography/' + getPostSlug(post),
	// 		},
	// 		content: translator.getPostContent(post, turndownService, config)
	// 	}));

	// console.log(records.length + ' records found.');

	return [...songs];
}

function getPostId(post) {
	return post.post_id[0];
}

function getPostSlug(post) {
	return post.post_name[0];
}

function getDir(post) {
	const cates = post.category.filter(cate => cate["$"].domain === 'category')
		.map(cate => cate["$"].nicename);
	return cates[0];
}


function getPostFullSlug(post) {
	return '/' + getDir(post) + '/' + post.post_name[0];
}

function getPostOrder(post) {
	return post.menu_order[0] ? Number.parseInt(post.menu_order[0]) : 0;
}

function getPostCoverImageId(post) {
	if (post.postmeta === undefined) {
		return undefined;
	}

	const postmeta = post.postmeta.find(postmeta => postmeta.meta_key[0] === '_thumbnail_id');
	const id = postmeta ? postmeta.meta_value[0] : undefined;
	return id;
}

function getPostTitle(post) {
	return post.title[0];
}

function getPostDate(post) {
	return luxon.DateTime.fromRFC2822(post.pubDate[0], { zone: 'utc' }).toISODate();
}

function getPostCategories(post) {
	//<category domain="category" nicename="rain-or-shine"><![CDATA[Rain or Shine]]></category>
	const cates = post.category.filter(cate => cate["$"].domain === 'category')
		.map(cate => cate["_"])
	//console.log(JSON.stringify(cates));
	return cates;
	// return post.categories.filter(cate => cate.domain === 'category')
	// 	.map(cate => cate.meta_value[0]);
}



function getPostTags(post) {
	//<category domain="category" nicename="rain-or-shine"><![CDATA[Rain or Shine]]></category>
	const tags = post.category.filter(cate => cate["$"].domain === 'post_tag')
		.map(cate => cate["_"])
	//console.log(JSON.stringify(cates));

	return tags;
	// return post.categories.filter(cate => cate.domain === 'category')
	// 	.map(cate => cate.meta_value[0]);
}

function getLicense(post) {
	const license = {};
	post.postmeta.filter(meta => meta.meta_key[0].startsWith('license-'))
		.map(meta => license[meta.meta_key[0].replace('license-', '')] = meta.meta_value[0]);
	// const json = JSON.stringify(license);
	// const unquoted = json.replace(/"([^"]+)":/g, '$1:');
	// console.log(unquoted);
	return license;
}

function getMeta(post, name) {
	const meta = post.postmeta.filter(meta => meta.meta_key[0] === name)
		.map(meta => meta.meta_value[0])
	return meta[0];
}

function getSongSinger(post) {
	const cates = getSongTags(post, 'singer');
	if (cates.length == 0) {
		return "未知"
	} else if (cates.length === 1) {
		return cates[0];
	} else {
		return "合唱"
	}
}

function getSongTags(post, name) {
	const cates = post.category.filter(cate => cate["$"].domain === name)
		.map(cate => cate["_"])
	return cates;
}

function getSongNiceName(post, name) {
	const cates = post.category.filter(cate => cate["$"].domain === name)
		.map(cate => cate["$"].nicename)
	return cates;
}


function collectAttachedImages(data) {
	const images = getItemsOfType(data, 'attachment')
		// filter to certain image file types
		.filter(attachment => (/\.(gif|jpe?g|png)$/i).test(attachment.attachment_url[0]))
		.map(attachment => ({
			id: attachment.post_id[0],
			postId: attachment.post_parent[0],
			url: attachment.attachment_url[0]
		}));

	console.log(images.length + ' attached images found.');
	return images;
}

function collectScrapedImages(data) {
	const images = [];
	getItemsOfType(data, 'post').forEach(post => {
		const postId = post.post_id[0];
		const postContent = post.encoded[0];
		const postLink = post.link[0];

		const matches = [...postContent.matchAll(/<img[^>]*src="(.+?\.(?:gif|jpe?g|png))"[^>]*>/gi)];
		matches.forEach(match => {
			// base the matched image URL relative to the post URL
			const url = new URL(match[1], postLink).href;

			images.push({
				id: -1,
				postId: postId,
				url: url
			});
		});
	});

	console.log(images.length + ' images scraped from post body content.');
	return images;
}

function mergeImagesIntoPosts(images, posts) {
	// create lookup table for quicker traversal
	const postsLookup = posts.reduce((lookup, post) => {
		lookup[post.meta.id] = post;
		return lookup;
	}, {});

	images.forEach(image => {
		const post = postsLookup[image.postId];
		if (post) {
			if (image.id === post.meta.coverImageId) {
				// save cover image filename to frontmatter
				post.frontmatter.coverImage = shared.getFilenameFromUrl(image.url);
			}

			// save (unique) full image URLs for downloading later
			if (!post.meta.imageUrls.includes(image.url)) {
				post.meta.imageUrls.push(image.url);
			}
		}
	});
}

exports.parseFilePromise = parseFilePromise;
