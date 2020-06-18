const encoded = "\\[trans\\]こんにちは。私のここ１ヶ月は慌しい毎日でした。でも、やっと音楽生活の話ができて嬉しいです。"

const turndown = require('turndown');

const turndownService = new turndown({
});

const html = `大家好。在我写下这句问候时，正是晴朗的早晨。<br/>
6点起床后，我就来到窗边暖洋洋地晒起来了太阳。
昨晚的工作不太顺利，结果就心情郁闷着睡觉去了。
最后胡乱给自己找了一些理由，比如“哎，马上就到明天。晚上写的情书，第二天早上读就会觉得很丢人，不敢再拿出手了吧。”

你是早睡早起型还是夜猫子型？`;

const content = turndownService.turndown(html);
console.log(content)


