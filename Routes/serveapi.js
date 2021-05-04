const express = require('express');
const router = express.Router();
const log = console.log;
const got = require('got');
const { URL } = require('url');

const serveapi = async (req, res) => {
  try {
    const fullurl = req.protocol + '://' + req.get('host') + req.originalUrl;
    const url = new URL(fullurl);
    const response = await got(url.searchParams.get('url'));
    return res.status(200).send(response.body);
  } catch (err) {
    res.status(500).send(err);
  }
};

router.get('/', serveapi);

module.exports = router;
