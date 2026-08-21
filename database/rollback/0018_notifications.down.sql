DELETE FROM `help_article_reads` WHERE `article_id`=18001;
DELETE FROM `help_articles` WHERE `id`=18001;
DROP TABLE IF EXISTS `notification_recipients`;
DROP TABLE IF EXISTS `notifications`;
