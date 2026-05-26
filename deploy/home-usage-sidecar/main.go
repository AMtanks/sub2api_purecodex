package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	_ "github.com/lib/pq"
)

type config struct {
	ListenAddr         string
	WindowHours        int
	DatabaseURL        string
	DBMaxOpenConns     int
	DBMaxIdleConns     int
	DBConnMaxLifetime  time.Duration
	QueryTimeout       time.Duration
	AllowedOrigins     []string
	ReflectAnyOrigin   bool
}

type responseEnvelope struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

type publicHomeUsageStats struct {
	WindowHours         int     `json:"window_hours"`
	TotalTokens         int64   `json:"total_tokens"`
	TotalActualCost     float64 `json:"total_actual_cost"`
	TokensPerCNY        float64 `json:"tokens_per_cny"`
	TokensPerCNYMillion float64 `json:"tokens_per_cny_million"`
	UpdatedAt           string  `json:"updated_at"`
}

type usageRepository struct {
	db *sql.DB
}

func main() {
	cfg, err := loadConfig()
	if err != nil {
		log.Fatalf("load config: %v", err)
	}

	db, err := sql.Open("postgres", cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("open database: %v", err)
	}
	defer db.Close()

	db.SetMaxOpenConns(cfg.DBMaxOpenConns)
	db.SetMaxIdleConns(cfg.DBMaxIdleConns)
	db.SetConnMaxLifetime(cfg.DBConnMaxLifetime)

	ctx, cancel := context.WithTimeout(context.Background(), cfg.QueryTimeout)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		log.Fatalf("ping database: %v", err)
	}

	repo := &usageRepository{db: db}
	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		applyCORS(w, r, cfg)
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		if r.Method != http.MethodGet {
			writeJSON(w, http.StatusMethodNotAllowed, responseEnvelope{Code: 1, Message: "method not allowed"})
			return
		}
		writeJSON(w, http.StatusOK, responseEnvelope{Code: 0, Message: "success", Data: map[string]string{"status": "ok"}})
	})
	mux.HandleFunc("/api/v1/public/home-usage", func(w http.ResponseWriter, r *http.Request) {
		applyCORS(w, r, cfg)
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		if r.Method != http.MethodGet {
			writeJSON(w, http.StatusMethodNotAllowed, responseEnvelope{Code: 1, Message: "method not allowed"})
			return
		}

		stats, err := repo.fetchHomeUsageStats(r.Context(), cfg.WindowHours, cfg.QueryTimeout)
		if err != nil {
			log.Printf("fetch home usage stats failed: %v", err)
			writeJSON(w, http.StatusInternalServerError, responseEnvelope{Code: 1, Message: "failed to fetch home usage stats"})
			return
		}

		writeJSON(w, http.StatusOK, responseEnvelope{Code: 0, Message: "success", Data: stats})
	})

	server := &http.Server{
		Addr:              cfg.ListenAddr,
		Handler:           withRequestLogging(mux),
		ReadHeaderTimeout: 5 * time.Second,
	}

	log.Printf("home-usage-sidecar listening on %s", cfg.ListenAddr)
	if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatalf("listen and serve: %v", err)
	}
}

func loadConfig() (*config, error) {
	windowHours, err := envInt("WINDOW_HOURS", 12)
	if err != nil {
		return nil, fmt.Errorf("parse WINDOW_HOURS: %w", err)
	}
	if windowHours <= 0 {
		return nil, fmt.Errorf("WINDOW_HOURS must be positive")
	}

	dbMaxOpenConns, err := envInt("DB_MAX_OPEN_CONNS", 2)
	if err != nil {
		return nil, fmt.Errorf("parse DB_MAX_OPEN_CONNS: %w", err)
	}
	dbMaxIdleConns, err := envInt("DB_MAX_IDLE_CONNS", 1)
	if err != nil {
		return nil, fmt.Errorf("parse DB_MAX_IDLE_CONNS: %w", err)
	}
	queryTimeoutSeconds, err := envInt("QUERY_TIMEOUT_SECONDS", 5)
	if err != nil {
		return nil, fmt.Errorf("parse QUERY_TIMEOUT_SECONDS: %w", err)
	}

	databaseURL := strings.TrimSpace(os.Getenv("DATABASE_URL"))
	if databaseURL == "" {
		host := envOrDefault("DATABASE_HOST", "postgres")
		port := envOrDefault("DATABASE_PORT", "5432")
		user := envOrDefault("DATABASE_USER", "sub2api")
		password := os.Getenv("DATABASE_PASSWORD")
		dbName := envOrDefault("DATABASE_DBNAME", "sub2api")
		sslMode := envOrDefault("DATABASE_SSLMODE", "disable")
		databaseURL = fmt.Sprintf(
			"postgres://%s:%s@%s:%s/%s?sslmode=%s",
			urlQueryEscape(user),
			urlQueryEscape(password),
			host,
			port,
			dbName,
			sslMode,
		)
	}

	allowedOrigins := parseAllowedOrigins(os.Getenv("CORS_ALLOWED_ORIGINS"))

	return &config{
		ListenAddr:        envOrDefault("LISTEN_ADDR", ":8080"),
		WindowHours:       windowHours,
		DatabaseURL:       databaseURL,
		DBMaxOpenConns:    dbMaxOpenConns,
		DBMaxIdleConns:    dbMaxIdleConns,
		DBConnMaxLifetime: 30 * time.Minute,
		QueryTimeout:      time.Duration(queryTimeoutSeconds) * time.Second,
		AllowedOrigins:    allowedOrigins,
		ReflectAnyOrigin:  len(allowedOrigins) == 0,
	}, nil
}

func (r *usageRepository) fetchHomeUsageStats(parent context.Context, windowHours int, timeout time.Duration) (*publicHomeUsageStats, error) {
	ctx, cancel := context.WithTimeout(parent, timeout)
	defer cancel()

	now := time.Now().UTC()
	start := now.Add(-time.Duration(windowHours) * time.Hour)

	const query = `
		SELECT
			COALESCE(SUM(input_tokens), 0) AS total_input_tokens,
			COALESCE(SUM(output_tokens), 0) AS total_output_tokens,
			COALESCE(SUM(cache_creation_tokens + cache_read_tokens), 0) AS total_cache_tokens,
			COALESCE(SUM(actual_cost), 0) AS total_actual_cost
		FROM usage_logs
		WHERE created_at >= $1 AND created_at < $2
	`

	var totalInputTokens int64
	var totalOutputTokens int64
	var totalCacheTokens int64
	var totalActualCost float64
	if err := r.db.QueryRowContext(ctx, query, start, now).Scan(
		&totalInputTokens,
		&totalOutputTokens,
		&totalCacheTokens,
		&totalActualCost,
	); err != nil {
		return nil, err
	}

	totalTokens := totalInputTokens + totalOutputTokens + totalCacheTokens
	var tokensPerCNY float64
	if totalActualCost > 0 {
		tokensPerCNY = float64(totalTokens) / totalActualCost
	}

	return &publicHomeUsageStats{
		WindowHours:         windowHours,
		TotalTokens:         totalTokens,
		TotalActualCost:     totalActualCost,
		TokensPerCNY:        tokensPerCNY,
		TokensPerCNYMillion: tokensPerCNY / 1_000_000,
		UpdatedAt:           now.Format(time.RFC3339),
	}, nil
}

func withRequestLogging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		log.Printf("%s %s %s", r.Method, r.URL.Path, time.Since(start).Round(time.Millisecond))
	})
}

func applyCORS(w http.ResponseWriter, r *http.Request, cfg *config) {
	origin := strings.TrimSpace(r.Header.Get("Origin"))
	if origin == "" {
		return
	}

	allowedOrigin := ""
	if cfg.ReflectAnyOrigin {
		allowedOrigin = origin
	} else {
		for _, candidate := range cfg.AllowedOrigins {
			if strings.EqualFold(candidate, origin) {
				allowedOrigin = origin
				break
			}
		}
	}

	if allowedOrigin == "" {
		return
	}

	headers := w.Header()
	headers.Set("Access-Control-Allow-Origin", allowedOrigin)
	headers.Set("Access-Control-Allow-Credentials", "true")
	headers.Set("Access-Control-Allow-Methods", "GET, OPTIONS")
	headers.Set("Access-Control-Allow-Headers", "Authorization, Content-Type, Accept-Language")
	headers.Set("Access-Control-Max-Age", "600")
	headers.Add("Vary", "Origin")
}

func writeJSON(w http.ResponseWriter, status int, payload responseEnvelope) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(payload); err != nil {
		log.Printf("encode response failed: %v", err)
	}
}

func envOrDefault(key, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return fallback
}

func envInt(key string, fallback int) (int, error) {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback, nil
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return 0, err
	}
	return parsed, nil
}

func parseAllowedOrigins(raw string) []string {
	if strings.TrimSpace(raw) == "" {
		return nil
	}
	parts := strings.Split(raw, ",")
	origins := make([]string, 0, len(parts))
	for _, part := range parts {
		origin := strings.TrimSpace(part)
		if origin != "" {
			origins = append(origins, origin)
		}
	}
	return origins
}

func urlQueryEscape(value string) string {
	replacer := strings.NewReplacer(
		"%", "%25",
		":", "%3A",
		"/", "%2F",
		"?", "%3F",
		"#", "%23",
		"[", "%5B",
		"]", "%5D",
		"@", "%40",
		"!", "%21",
		"$", "%24",
		"&", "%26",
		"'", "%27",
		"(", "%28",
		")", "%29",
		"*", "%2A",
		"+", "%2B",
		",", "%2C",
		";", "%3B",
		"=", "%3D",
		" ", "%20",
	)
	return replacer.Replace(value)
}
